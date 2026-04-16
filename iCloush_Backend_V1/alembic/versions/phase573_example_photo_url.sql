-- Phase 5.7.3: 添加 example_photo_url 字段到 tasks 表
-- 手动执行此SQL（如果alembic迁移不方便）
-- 在微信云托管数据库管理中执行

ALTER TABLE tasks ADD COLUMN example_photo_url VARCHAR(512) DEFAULT NULL;
