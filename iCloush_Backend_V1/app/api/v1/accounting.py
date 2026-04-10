"""
管理会计路由 — Phase 3B 纯财务直录台 + 利润表
═══════════════════════════════════════════════════
核心功能：
  1. 纯财务直录台：管理员手动录入成本（折旧、工资等无需发票的成本）
  2. 成本流水列表：多维筛选查询
  3. 实时贡献利润表：营收 - 变动成本 = 边际贡献 - 固定成本 = 经营净利润
  4. 税务漏洞追踪：无票成本 × 25% 企业所得税
  5. 成本分类汇总：按 category_code 聚合

接口清单：
  POST /cost/create               手动录入成本（纯财务直录台）
  GET  /cost/list                 成本流水列表
  GET  /cost/{id}                 成本流水详情
  PUT  /cost/{id}                 编辑成本流水
  DELETE /cost/{id}               删除成本流水
  GET  /profit-statement          实时贡献利润表
  GET  /tax-leakage               税务漏洞追踪
  GET  /cost-summary              成本分类汇总
  GET  /categories                成本分类配置

数据隔离：所有接口限制 role>=5
"""
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_role
from app.models.models import User, DailyProduction
from app.models.finance import ManagementCostLedger, MonthlyRevenue, COST_CATEGORIES

router = APIRouter()


# ═══════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════

class CostCreateRequest(BaseModel):
    """手动录入成本（纯财务直录台）
    兼容两套字段名：
      后端原始: trade_date, item_name, pre_tax_amount
      前端简化: occur_date, description, amount
    """
    # 后端原始字段（可选，与前端别名二选一）
    trade_date: Optional[str] = Field(default=None, description="交易日期 YYYY-MM-DD")
    item_name: Optional[str] = Field(default=None, max_length=200, description="明细名称")
    pre_tax_amount: Optional[float] = Field(default=None, gt=0, description="不含税金额")
    # 前端简化字段（别名）
    occur_date: Optional[str] = Field(default=None, description="交易日期 YYYY-MM-DD（前端别名）")
    description: Optional[str] = Field(default=None, max_length=200, description="明细名称（前端别名）")
    amount: Optional[float] = Field(default=None, gt=0, description="金额（前端别名）")
    # 通用字段
    supplier_name: Optional[str] = Field(default=None, description="供应商/收款方")
    tax_rate: float = Field(default=0, ge=0, le=100, description="税率（如 6 = 6%）")
    invoice_status: str = Field(default="none", description="发票状态: special_vat/general_vat/none")
    category_code: str = Field(..., description="成本分类代码: E-0~E-10")
    is_sunk_cost: bool = Field(default=False, description="是否为沉没成本")
    remark: Optional[str] = Field(default=None, description="备注")

    def get_trade_date(self) -> str:
        """优先使用 trade_date，回退到 occur_date"""
        return self.trade_date or self.occur_date or ""

    def get_item_name(self) -> str:
        """优先使用 item_name，回退到 description"""
        return self.item_name or self.description or "手动录入"

    def get_amount(self) -> float:
        """优先使用 pre_tax_amount，回退到 amount"""
        return self.pre_tax_amount or self.amount or 0.0


class CostUpdateRequest(BaseModel):
    """编辑成本流水（兼容前端简化字段名）"""
    trade_date: Optional[str] = None
    item_name: Optional[str] = None
    supplier_name: Optional[str] = None
    pre_tax_amount: Optional[float] = None
    tax_rate: Optional[float] = None
    invoice_status: Optional[str] = None
    category_code: Optional[str] = None
    is_sunk_cost: Optional[bool] = None
    # 前端简化字段（别名）
    occur_date: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    remark: Optional[str] = None

    def get_trade_date(self) -> Optional[str]:
        return self.trade_date or self.occur_date

    def get_item_name(self) -> Optional[str]:
        return self.item_name if self.item_name is not None else self.description

    def get_amount(self) -> Optional[float]:
        return self.pre_tax_amount if self.pre_tax_amount is not None else self.amount


# ═══════════════════════════════════════════════════
# 手动录入成本（纯财务直录台）
# ═══════════════════════════════════════════════════

@router.post("/cost/create")
async def create_cost_entry(
    req: CostCreateRequest,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """
    纯财务直录台 — 手动录入成本
    适用场景：折旧、工资、社保等无需发票的固定成本
    自动计算：tax_amount = pre_tax_amount × tax_rate / 100
              post_tax_amount = pre_tax_amount + tax_amount
    """
    # 通过兼容方法获取实际值（支持前端简化字段名）
    actual_amount = req.get_amount()
    actual_item_name = req.get_item_name()
    actual_trade_date_str = req.get_trade_date()

    if not actual_amount or actual_amount <= 0:
        raise HTTPException(status_code=422, detail="金额必须大于 0（使用 pre_tax_amount 或 amount 字段）")

    if req.category_code not in COST_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"无效的成本分类代码: {req.category_code}")

    if req.invoice_status not in ("special_vat", "general_vat", "none"):
        raise HTTPException(status_code=422, detail="发票状态必须为 special_vat/general_vat/none")

    cat_config = COST_CATEGORIES[req.category_code]

    # 自动计算税额
    pre_tax = Decimal(str(actual_amount))
    tax_rate = Decimal(str(req.tax_rate))
    tax_amount = (pre_tax * tax_rate / Decimal("100")).quantize(Decimal("0.01"))
    post_tax = pre_tax + tax_amount

    # 解析日期（允许为空，默认今天）
    if actual_trade_date_str:
        try:
            trade_date = date.fromisoformat(actual_trade_date_str)
        except ValueError:
            raise HTTPException(status_code=422, detail="日期格式错误，请使用 YYYY-MM-DD")
    else:
        trade_date = date.today()

    # 解析发生日期（occur_date 单独存储，默认=当月最后一天）
    occur_date_val = None
    if req.occur_date:
        try:
            occur_date_val = date.fromisoformat(req.occur_date)
        except ValueError:
            pass
    if not occur_date_val:
        # 默认当月最后一天
        import calendar
        last_day = calendar.monthrange(trade_date.year, trade_date.month)[1]
        occur_date_val = date(trade_date.year, trade_date.month, last_day)

    entry = ManagementCostLedger(
        trade_date=trade_date,
        occur_date=occur_date_val,
        item_name=actual_item_name,
        supplier_name=req.supplier_name,
        pre_tax_amount=pre_tax,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        post_tax_amount=post_tax,
        invoice_status=req.invoice_status,
        category_code=req.category_code,
        cost_behavior=cat_config["behavior"],
        cost_center=cat_config["center"],
        is_sunk_cost=req.is_sunk_cost,
        source_type="manual",
        source_id=None,
        status="confirmed",
        created_by=current_user.id,
    )
    db.add(entry)
    await db.flush()

    return {
        "code": 200,
        "message": "成本录入成功",
        "data": _serialize_cost(entry),
    }


# ═══════════════════════════════════════════════════
# 成本流水列表
# ═══════════════════════════════════════════════════

@router.get("/cost/list")
async def list_cost_entries(
    year: Optional[int] = Query(default=None, description="年份"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="月份"),
    category_code: Optional[str] = Query(default=None, description="成本分类"),
    cost_behavior: Optional[str] = Query(default=None, description="成本性态: variable/fixed"),
    source_type: Optional[str] = Query(default=None, description="来源: manual/expense_report"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """成本流水列表（多维筛选）"""
    query = select(ManagementCostLedger)

    # 时间筛选
    if year:
        query = query.where(extract("year", ManagementCostLedger.trade_date) == year)
    if month:
        query = query.where(extract("month", ManagementCostLedger.trade_date) == month)

    # 分类筛选
    if category_code:
        query = query.where(ManagementCostLedger.category_code == category_code)
    if cost_behavior:
        query = query.where(ManagementCostLedger.cost_behavior == cost_behavior)
    if source_type:
        query = query.where(ManagementCostLedger.source_type == source_type)

    # 总数
    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0

    # 排序 + 分页
    query = query.order_by(ManagementCostLedger.trade_date.desc(), ManagementCostLedger.id.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    entries = result.scalars().all()

    return {
        "code": 200,
        "data": [_serialize_cost(e) for e in entries],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ═══════════════════════════════════════════════════
# 成本流水详情
# ═══════════════════════════════════════════════════

@router.get("/cost/{entry_id}")
async def get_cost_entry(
    entry_id: int,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """成本流水详情"""
    result = await db.execute(
        select(ManagementCostLedger).where(ManagementCostLedger.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="成本记录不存在")
    return {"code": 200, "data": _serialize_cost(entry)}


# ═══════════════════════════════════════════════════
# 编辑成本流水
# ═══════════════════════════════════════════════════

@router.put("/cost/{entry_id}")
async def update_cost_entry(
    entry_id: int,
    req: CostUpdateRequest,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """编辑成本流水（管理员可编辑所有来源的成本，包括报销自动生成的）"""
    result = await db.execute(
        select(ManagementCostLedger).where(ManagementCostLedger.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="成本记录不存在")

    actual_trade_date = req.get_trade_date()
    actual_item_name = req.get_item_name()
    actual_amount = req.get_amount()

    if actual_trade_date:
        try:
            entry.trade_date = date.fromisoformat(actual_trade_date)
        except ValueError:
            raise HTTPException(status_code=422, detail="日期格式错误")
    # 如果前端传了 occur_date，也更新 occur_date 字段
    if req.occur_date:
        try:
            entry.occur_date = date.fromisoformat(req.occur_date)
        except ValueError:
            pass
    if actual_item_name is not None:
        entry.item_name = actual_item_name
    if req.supplier_name is not None:
        entry.supplier_name = req.supplier_name
    if req.invoice_status is not None:
        entry.invoice_status = req.invoice_status
    if req.is_sunk_cost is not None:
        entry.is_sunk_cost = req.is_sunk_cost
    if req.remark is not None:
        entry.remark = req.remark

    # 如果分类变了，更新关联的 behavior 和 center
    if req.category_code is not None:
        if req.category_code not in COST_CATEGORIES:
            raise HTTPException(status_code=422, detail=f"无效的成本分类代码: {req.category_code}")
        cat_config = COST_CATEGORIES[req.category_code]
        entry.category_code = req.category_code
        entry.cost_behavior = cat_config["behavior"]
        entry.cost_center = cat_config["center"]

    # 如果金额或税率变了，重新计算
    if actual_amount is not None or req.tax_rate is not None:
        pre_tax = Decimal(str(actual_amount)) if actual_amount else entry.pre_tax_amount
        tax_rate = Decimal(str(req.tax_rate)) if req.tax_rate is not None else entry.tax_rate
        tax_amount = (pre_tax * tax_rate / Decimal("100")).quantize(Decimal("0.01"))
        entry.pre_tax_amount = pre_tax
        entry.tax_rate = tax_rate
        entry.tax_amount = tax_amount
        entry.post_tax_amount = pre_tax + tax_amount

    await db.flush()
    return {"code": 200, "message": "更新成功", "data": _serialize_cost(entry)}


# ═══════════════════════════════════════════════════
# 删除成本流水
# ═══════════════════════════════════════════════════

@router.delete("/cost/{entry_id}")
async def delete_cost_entry(
    entry_id: int,
    current_user: User = Depends(require_role(7)),  # 经理级别才能删除
    db: AsyncSession = Depends(get_db),
):
    """删除成本流水（需经理权限，所有来源均可删除）"""
    result = await db.execute(
        select(ManagementCostLedger).where(ManagementCostLedger.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="成本记录不存在")

    await db.delete(entry)
    await db.flush()
    return {"code": 200, "message": "成本记录已删除"}


# ═══════════════════════════════════════════════════
# 实时贡献利润表
# ═══════════════════════════════════════════════════

@router.get("/profit-statement")
async def profit_statement(
    year: Optional[int] = Query(default=None, description="年份"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="月份"),
    period: Optional[str] = Query(default=None, description="年月（YYYY-MM），与 year/month 二选一"),
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """
    实时贡献利润表
    公式：
      营收（从产能报表估算）
      - 变动成本 = 边际贡献
      - 固定成本 = 经营净利润
    """
    # 兼容前端 period=YYYY-MM 参数
    if period and not year:
        try:
            parts = period.split("-")
            year = int(parts[0])
            month = int(parts[1])
        except (ValueError, IndexError):
            raise HTTPException(status_code=422, detail="period 格式错误，请使用 YYYY-MM")
    if not year or not month:
        now = datetime.now()
        year = year or now.year
        month = month or now.month

    # 1. 查询该月所有成本流水（按 occur_date 统计，回退到 trade_date）
    result = await db.execute(
        select(ManagementCostLedger).where(
            and_(
                extract("year", func.coalesce(ManagementCostLedger.occur_date, ManagementCostLedger.trade_date)) == year,
                extract("month", func.coalesce(ManagementCostLedger.occur_date, ManagementCostLedger.trade_date)) == month,
            )
        )
    )
    costs = result.scalars().all()

    # 2. 分类汇总
    variable_costs = sum(float(c.post_tax_amount) for c in costs if c.cost_behavior == "variable")
    fixed_costs = sum(float(c.post_tax_amount) for c in costs if c.cost_behavior == "fixed")
    total_costs = variable_costs + fixed_costs

    # 3. 按 category_code 细分
    by_category = defaultdict(float)
    for c in costs:
        cat_name = COST_CATEGORIES.get(c.category_code, {}).get("name", c.category_code)
        by_category[cat_name] += float(c.post_tax_amount)

    # 4. 按 cost_center 细分
    by_center = defaultdict(float)
    CENTER_LABELS = {
        "direct_material": "直接材料",
        "direct_labor": "直接人工",
        "manufacturing_overhead": "制造费用",
        "period_expense": "期间费用",
    }
    for c in costs:
        center_label = CENTER_LABELS.get(c.cost_center, c.cost_center)
        by_center[center_label] += float(c.post_tax_amount)

    # 5. 营收：优先从 MonthlyRevenue 表读取手动录入的营收，回退到产能估算
    rev_result = await db.execute(
        select(MonthlyRevenue).where(
            and_(MonthlyRevenue.year == year, MonthlyRevenue.month == month)
        )
    )
    rev_entry = rev_result.scalar_one_or_none()
    revenue_source = "manual"

    if rev_entry:
        revenue = float(rev_entry.revenue)
    else:
        # 回退到产能估算
        revenue_source = "estimated"
        month_str_start = f"{year}-{month:02d}-01"
        month_str_end = f"{year}-{month:02d}-31"
        prod_result = await db.execute(
            select(DailyProduction).where(
                and_(
                    DailyProduction.date >= month_str_start,
                    DailyProduction.date <= month_str_end,
                )
            )
        )
        productions = prod_result.scalars().all()
        total_sets = sum(p.total_sets for p in productions)
        revenue = total_sets * 200.0

    # 6. 计算利润
    contribution_margin = revenue - variable_costs
    net_operating_profit = contribution_margin - fixed_costs

    # 7. 边际贡献率 & 盈亏平衡点
    cm_ratio = contribution_margin / revenue if revenue > 0 else 0
    breakeven_revenue = fixed_costs / cm_ratio if cm_ratio > 0 else 0

    # 8. 税务漏洞
    no_invoice_total = sum(
        float(c.post_tax_amount) for c in costs if c.invoice_status == "none"
    )
    estimated_tax_loss = no_invoice_total * 0.25  # 企业所得稥25%

    return {
        "code": 200,
        "data": {
            "period": f"{year}-{month:02d}",
            "revenue": round(revenue, 2),
            "revenue_source": revenue_source,
            # 后端原始字段
            "variable_costs": round(variable_costs, 2),
            "fixed_costs": round(fixed_costs, 2),
            "total_costs": round(total_costs, 2),
            "contribution_margin": round(contribution_margin, 2),
            "net_operating_profit": round(net_operating_profit, 2),
            # 前端期望的别名字段
            "variable_cost": round(variable_costs, 2),
            "fixed_cost": round(fixed_costs, 2),
            "net_profit": round(net_operating_profit, 2),
            "cm_ratio": round(cm_ratio, 4),
            "breakeven_revenue": round(breakeven_revenue, 2),
            # 细分
            "by_category": {k: round(v, 2) for k, v in sorted(by_category.items(), key=lambda x: -x[1])},
            "by_center": {k: round(v, 2) for k, v in sorted(by_center.items(), key=lambda x: -x[1])},
            "tax_leakage": {
                "no_invoice_total": round(no_invoice_total, 2),
                "estimated_tax_loss": round(estimated_tax_loss, 2),
            },
            "cost_entry_count": len(costs),
        },
    }


# ═══════════════════════════════════════════════════
# 税务漏洞追踪
# ═══════════════════════════════════════════════════

@router.get("/tax-leakage")
async def tax_leakage(
    year: int = Query(..., description="年份"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="月份（不传则全年）"),
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """
    税务漏洞追踪
    列出所有无票成本，计算潜在税务损失
    """
    query = select(ManagementCostLedger).where(
        and_(
            extract("year", ManagementCostLedger.trade_date) == year,
            ManagementCostLedger.invoice_status == "none",
        )
    )
    if month:
        query = query.where(extract("month", ManagementCostLedger.trade_date) == month)

    query = query.order_by(ManagementCostLedger.trade_date.desc())
    result = await db.execute(query)
    entries = result.scalars().all()

    total_no_invoice = sum(float(e.post_tax_amount) for e in entries)
    estimated_tax_loss = total_no_invoice * 0.25

    # 按分类汇总无票金额
    by_category = defaultdict(float)
    for e in entries:
        cat_name = COST_CATEGORIES.get(e.category_code, {}).get("name", e.category_code)
        by_category[cat_name] += float(e.post_tax_amount)

    return {
        "code": 200,
        "data": {
            "total_no_invoice": round(total_no_invoice, 2),
            "estimated_tax_loss": round(estimated_tax_loss, 2),
            "entry_count": len(entries),
            "by_category": {k: round(v, 2) for k, v in sorted(by_category.items(), key=lambda x: -x[1])},
            "entries": [_serialize_cost(e) for e in entries[:50]],  # 最多返回50条
        },
    }


# ═════════════════════════════════════════════════
# 营收直录（Phase 4.2）
# ═════════════════════════════════════════════════

class RevenueCreateRequest(BaseModel):
    year: int = Field(..., description="年份")
    month: int = Field(..., ge=1, le=12, description="月份")
    revenue: float = Field(..., gt=0, description="总营收")
    remark: Optional[str] = Field(default=None, description="备注")


@router.post("/revenue/upsert")
async def upsert_revenue(
    req: RevenueCreateRequest,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """
    营收直录 — 同一年月只保留一条（upsert）
    """
    result = await db.execute(
        select(MonthlyRevenue).where(
            and_(MonthlyRevenue.year == req.year, MonthlyRevenue.month == req.month)
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.revenue = Decimal(str(req.revenue))
        existing.remark = req.remark
        existing.created_by = current_user.id
        await db.flush()
        return {
            "code": 200,
            "message": f"{req.year}年{req.month}月营收已更新",
            "data": _serialize_revenue(existing),
        }
    else:
        entry = MonthlyRevenue(
            year=req.year,
            month=req.month,
            revenue=Decimal(str(req.revenue)),
            remark=req.remark,
            created_by=current_user.id,
        )
        db.add(entry)
        await db.flush()
        return {
            "code": 200,
            "message": f"{req.year}年{req.month}月营收已录入",
            "data": _serialize_revenue(entry),
        }


@router.delete("/revenue/{revenue_id}")
async def delete_revenue(
    revenue_id: int,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """删除营收记录"""
    result = await db.execute(
        select(MonthlyRevenue).where(MonthlyRevenue.id == revenue_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="营收记录不存在")
    await db.delete(entry)
    await db.flush()
    return {"code": 200, "message": "营收记录已删除"}


@router.get("/revenue/list")
async def list_revenue(
    year: Optional[int] = Query(default=None, description="年份"),
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """查询营收记录列表"""
    if not year:
        year = datetime.now().year
    result = await db.execute(
        select(MonthlyRevenue)
        .where(MonthlyRevenue.year == year)
        .order_by(MonthlyRevenue.month.desc())
    )
    entries = result.scalars().all()
    return {
        "code": 200,
        "data": [_serialize_revenue(e) for e in entries],
    }


def _serialize_revenue(e: MonthlyRevenue) -> dict:
    return {
        "id": e.id,
        "year": e.year,
        "month": e.month,
        "period": f"{e.year}-{e.month:02d}",
        "revenue": float(e.revenue),
        "remark": e.remark,
        "created_by": e.created_by,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


# ═════════════════════════════════════════════════
# 成本分类汇总
# ═════════════════════════════════════════════════════

@router.get("/cost-summary")
async def cost_summary(
    year: int = Query(..., description="年份"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="月份"),
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """成本分类汇总（饼图/柱状图数据源）"""
    query = select(ManagementCostLedger).where(
        extract("year", ManagementCostLedger.trade_date) == year
    )
    if month:
        query = query.where(extract("month", ManagementCostLedger.trade_date) == month)

    result = await db.execute(query)
    entries = result.scalars().all()

    # 按 category_code 汇总
    by_category = defaultdict(lambda: {"amount": 0.0, "count": 0})
    for e in entries:
        by_category[e.category_code]["amount"] += float(e.post_tax_amount)
        by_category[e.category_code]["count"] += 1

    summary = []
    for code, data in sorted(by_category.items(), key=lambda x: -x[1]["amount"]):
        cat_config = COST_CATEGORIES.get(code, {})
        summary.append({
            "category_code": code,
            "category_name": cat_config.get("name", code),
            "behavior": cat_config.get("behavior", "unknown"),
            "center": cat_config.get("center", "unknown"),
            "total_amount": round(data["amount"], 2),
            "entry_count": data["count"],
        })

    return {
        "code": 200,
        "data": {
            "period": f"{year}" + (f"-{month:02d}" if month else ""),
            "total_amount": round(sum(d["amount"] for d in by_category.values()), 2),
            "total_entries": sum(d["count"] for d in by_category.values()),
            "categories": summary,
        },
    }


# ═══════════════════════════════════════════════════
# 成本分类明细账（Phase 4.1 PRD 2.3）
# ═══════════════════════════════════════════════════

@router.get("/cost-ledger")
async def cost_ledger_detail(
    year: Optional[int] = Query(default=None, description="年份"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="月份"),
    period: Optional[str] = Query(default=None, description="年月 YYYY-MM"),
    category_code: Optional[str] = Query(default=None, description="成本分类代码，不传则返回全部"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """
    成本分类明细账 — Phase 4.1 PRD 2.3
    前端 Tab 切换分类时调用，返回：
      1. 该分类的汇总金额和笔数
      2. 该分类下的明细列表（按时间倒序）
    """
    # 兼容 period 参数
    if period and not year:
        try:
            parts = period.split("-")
            year = int(parts[0])
            month = int(parts[1])
        except (ValueError, IndexError):
            raise HTTPException(status_code=422, detail="period 格式错误，请使用 YYYY-MM")
    if not year:
        now = datetime.now()
        year = now.year
        month = month or now.month

    # 基础查询条件 — 按 occur_date（发生日期）做月份聚类，回退到 trade_date
    conditions = [extract("year", func.coalesce(ManagementCostLedger.occur_date, ManagementCostLedger.trade_date)) == year]
    if month:
        conditions.append(extract("month", func.coalesce(ManagementCostLedger.occur_date, ManagementCostLedger.trade_date)) == month)
    if category_code:
        conditions.append(ManagementCostLedger.category_code == category_code)

    # 汇总
    sum_query = select(
        func.count(ManagementCostLedger.id).label("total_count"),
        func.coalesce(func.sum(ManagementCostLedger.post_tax_amount), 0).label("total_amount"),
    ).where(and_(*conditions))
    sum_result = await db.execute(sum_query)
    row = sum_result.one()
    total_count = row.total_count
    total_amount = float(row.total_amount)

    # 明细列表
    list_query = (
        select(ManagementCostLedger)
        .where(and_(*conditions))
        .order_by(ManagementCostLedger.trade_date.desc(), ManagementCostLedger.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    list_result = await db.execute(list_query)
    entries = list_result.scalars().all()

    # 查询录入人姓名
    creator_ids = list(set(e.created_by for e in entries if e.created_by))
    creators_map = {}
    if creator_ids:
        users_result = await db.execute(select(User).where(User.id.in_(creator_ids)))
        for u in users_result.scalars().all():
            creators_map[u.id] = u.name or u.username or f"用户#{u.id}"

    items = []
    for e in entries:
        d = _serialize_cost(e)
        d["creator_name"] = creators_map.get(e.created_by, f"用户#{e.created_by}")
        items.append(d)

    return {
        "code": 200,
        "data": {
            "period": f"{year}" + (f"-{month:02d}" if month else ""),
            "category_code": category_code,
            "category_name": COST_CATEGORIES.get(category_code, {}).get("name", "全部") if category_code else "全部",
            "summary": {
                "total_amount": round(total_amount, 2),
                "total_count": total_count,
            },
            "items": items,
            "page": page,
            "page_size": page_size,
        },
    }


# ═══════════════════════════════════════════════════
# 成本分类配置
# ═══════════════════════════════════════════════════

@router.get("/categories")
async def list_categories(
    current_user: User = Depends(require_role(5)),
):
    """获取成本分类配置列表"""
    categories = [
        {
            "code": code,
            "name": config["name"],
            "behavior": config["behavior"],
            "behavior_label": "变动成本" if config["behavior"] == "variable" else "固定成本",
            "center": config["center"],
        }
        for code, config in COST_CATEGORIES.items()
    ]
    return {"code": 200, "data": categories}


# ═══════════════════════════════════════════════════
# 序列化
# ═══════════════════════════════════════════════════

def _serialize_cost(e: ManagementCostLedger) -> dict:
    cat_config = COST_CATEGORIES.get(e.category_code, {})
    SOURCE_LABELS = {
        "manual": "手动录入",
        "expense_report": "报销自动",
        "iot_auto": "IoT自动",
        "schedule_auto": "排班自动",
        "depreciation_auto": "折旧自动",
    }
    return {
        "id": e.id,
        "trade_date": e.trade_date.isoformat() if e.trade_date else None,
        "occur_date": e.occur_date.isoformat() if e.occur_date else (e.trade_date.isoformat() if e.trade_date else None),
        "item_name": e.item_name,
        "supplier_name": e.supplier_name,
        "pre_tax_amount": float(e.pre_tax_amount) if e.pre_tax_amount else 0,
        "tax_rate": float(e.tax_rate) if e.tax_rate else 0,
        "tax_amount": float(e.tax_amount) if e.tax_amount else 0,
        "post_tax_amount": float(e.post_tax_amount) if e.post_tax_amount else 0,
        "invoice_status": e.invoice_status,
        "invoice_status_label": {"special_vat": "专票", "general_vat": "普票", "none": "无票"}.get(e.invoice_status, "未知"),
        "category_code": e.category_code,
        "category_name": cat_config.get("name", e.category_code),
        "cost_behavior": e.cost_behavior,
        "cost_behavior_label": "变动成本" if e.cost_behavior == "variable" else "固定成本",
        "cost_center": e.cost_center,
        "is_sunk_cost": e.is_sunk_cost,
        "source_type": e.source_type,
        "source_label": SOURCE_LABELS.get(e.source_type, "未知"),
        "source_id": e.source_id,
        "status": e.status,
        "created_by": e.created_by,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        # 前端别名字段（cost-entry 页面使用）
        "amount": float(e.pre_tax_amount) if e.pre_tax_amount else 0,
        "description": e.item_name,
    }
