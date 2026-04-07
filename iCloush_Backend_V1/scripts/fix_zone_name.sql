-- 修复工区名称错别字：燫烫区 → 熨烫区
UPDATE zones SET name = '熨烫区' WHERE code = 'zone_c' AND name != '熨烫区';
