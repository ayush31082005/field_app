import pool from '../../config/db';

export const getDashboardData = async () => {
  const [summaryRows]: any = await pool.query(`
    SELECT
      COUNT(*) AS totalCases,
      SUM(CASE WHEN COALESCE(w.case_status, a.status) IN ('pending','draft','in review','PENDING','UNDER_REVIEW','FIELD_VERIFICATION') THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN w.stage = 'FINALIZED' OR COALESCE(w.case_status, a.status) IN ('approved','rejected','loan reject','APPROVED','REJECTED','SENT_TO_CREDIT','FORWARDED_REJECT') THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN COALESCE(w.case_status, a.status) IN ('approved','APPROVED','SENT_TO_CREDIT') THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN COALESCE(w.case_status, a.status) IN ('rejected','loan reject','REJECTED','FORWARDED_REJECT') THEN 1 ELSE 0 END) AS rejected,
      ROUND(AVG(CASE WHEN w.updated_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, a.created_at, w.updated_at) / 24 END), 1) AS avgTat
    FROM applications a
    LEFT JOIN fcu_case_workflows w ON w.application_id = a.id
  `);

  const [dailyRows]: any = await pool.query(`
    SELECT DATE_FORMAT(days.day, '%a') AS day,
      COUNT(a.id) AS assigned,
      SUM(CASE WHEN w.stage = 'FINALIZED' THEN 1 ELSE 0 END) AS completed
    FROM (
      SELECT CURDATE() - INTERVAL 6 DAY AS day UNION ALL SELECT CURDATE() - INTERVAL 5 DAY UNION ALL
      SELECT CURDATE() - INTERVAL 4 DAY UNION ALL SELECT CURDATE() - INTERVAL 3 DAY UNION ALL
      SELECT CURDATE() - INTERVAL 2 DAY UNION ALL SELECT CURDATE() - INTERVAL 1 DAY UNION ALL SELECT CURDATE()
    ) days
    LEFT JOIN applications a ON DATE(a.created_at) = days.day
    LEFT JOIN fcu_case_workflows w ON w.application_id = a.id
    GROUP BY days.day ORDER BY days.day
  `);

  const [monthlyRows]: any = await pool.query(`
    SELECT DATE_FORMAT(months.month_start, '%b') AS month,
      SUM(CASE WHEN COALESCE(w.case_status, a.status) IN ('approved','APPROVED','SENT_TO_CREDIT') THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN COALESCE(w.case_status, a.status) IN ('rejected','loan reject','REJECTED','FORWARDED_REJECT') THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN COALESCE(w.case_status, a.status) IN ('pending','draft','in review','PENDING','UNDER_REVIEW','FIELD_VERIFICATION') THEN 1 ELSE 0 END) AS pending
    FROM (
      SELECT DATE_FORMAT(CURDATE() - INTERVAL 5 MONTH, '%Y-%m-01') AS month_start UNION ALL
      SELECT DATE_FORMAT(CURDATE() - INTERVAL 4 MONTH, '%Y-%m-01') UNION ALL
      SELECT DATE_FORMAT(CURDATE() - INTERVAL 3 MONTH, '%Y-%m-01') UNION ALL
      SELECT DATE_FORMAT(CURDATE() - INTERVAL 2 MONTH, '%Y-%m-01') UNION ALL
      SELECT DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01') UNION ALL
      SELECT DATE_FORMAT(CURDATE(), '%Y-%m-01')
    ) months
    LEFT JOIN applications a ON DATE_FORMAT(a.created_at, '%Y-%m') = DATE_FORMAT(months.month_start, '%Y-%m')
    LEFT JOIN fcu_case_workflows w ON w.application_id = a.id
    GROUP BY months.month_start ORDER BY months.month_start
  `);

  const [statusRows]: any = await pool.query(`
    SELECT UPPER(REPLACE(COALESCE(w.case_status, a.status, 'PENDING'), ' ', '_')) AS name, COUNT(*) AS value
    FROM applications a LEFT JOIN fcu_case_workflows w ON w.application_id = a.id
    GROUP BY name ORDER BY value DESC
  `);

  const [executiveRows]: any = await pool.query(`
    SELECT fu.name, COUNT(w.id) AS cases,
      SUM(CASE WHEN w.stage = 'FINALIZED' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN w.stage <> 'FINALIZED' THEN 1 ELSE 0 END) AS pending,
      ROUND(AVG(TIMESTAMPDIFF(HOUR, a.created_at, w.updated_at)) / 24, 1) AS tat
    FROM fcu_users fu
    LEFT JOIN fcu_case_workflows w ON w.reviewed_by = fu.id
    LEFT JOIN applications a ON a.id = w.application_id
    WHERE fu.status = 'active'
    GROUP BY fu.id, fu.name ORDER BY completed DESC, cases DESC
  `);

  const [branchRows]: any = await pool.query(`
    SELECT COALESCE(NULLIF(ed.work_city, ''), NULLIF(up.city, ''), 'Unassigned') AS name,
      COUNT(a.id) AS assigned,
      SUM(CASE WHEN COALESCE(w.case_status, a.status) IN ('approved','APPROVED','SENT_TO_CREDIT') THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN COALESCE(w.case_status, a.status) IN ('rejected','loan reject','REJECTED','FORWARDED_REJECT') THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN COALESCE(w.case_status, a.status) IN ('pending','draft','in review','PENDING','UNDER_REVIEW','FIELD_VERIFICATION') THEN 1 ELSE 0 END) AS pending,
      ROUND(AVG(CASE WHEN w.updated_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, a.created_at, w.updated_at) / 24 END), 1) AS tat
    FROM applications a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN employment_details ed ON ed.user_id = u.id
    LEFT JOIN fcu_case_workflows w ON w.application_id = a.id
    GROUP BY name ORDER BY assigned DESC LIMIT 8
  `);

  const [purposeRows]: any = await pool.query(`
    SELECT COALESCE(NULLIF(loan_purpose, ''), 'Other') AS purpose, COUNT(*) AS count
    FROM applications GROUP BY purpose ORDER BY count DESC LIMIT 8
  `);

  const summary = summaryRows[0] || {};
  const total = Number(summary.totalCases || 0);
  const approved = Number(summary.approved || 0);
  const rejected = Number(summary.rejected || 0);

  return {
    summary: {
      totalCases: total,
      assigned: dailyRows.reduce((sum: number, row: any) => sum + Number(row.assigned || 0), 0),
      pending: Number(summary.pending || 0),
      completed: Number(summary.completed || 0),
      approved,
      rejected,
      avgTat: Number(summary.avgTat || 0),
      approvalRatio: total ? Number(((approved / total) * 100).toFixed(1)) : 0,
      rejectionRatio: total ? Number(((rejected / total) * 100).toFixed(1)) : 0,
      fraudDetected: 0,
    },
    dailyCases: dailyRows.map((row: any) => ({ day: row.day, assigned: Number(row.assigned), completed: Number(row.completed), pending: Number(row.assigned) - Number(row.completed) })),
    tatTrend: monthlyRows.map((row: any) => ({ week: row.month, tat: Number(summary.avgTat || 0) })),
    approvalTrend: monthlyRows.map((row: any) => ({ month: row.month, approved: Number(row.approved), rejected: Number(row.rejected), pending: Number(row.pending) })),
    caseStatusPie: statusRows.map((row: any) => ({ name: row.name, value: Number(row.value) })),
    executives: executiveRows.map((row: any) => {
      const cases = Number(row.cases || 0); const completed = Number(row.completed || 0);
      return { name: row.name, cases, completed, pending: Number(row.pending || 0), tat: `${Number(row.tat || 0)}d`, score: cases ? Math.round((completed / cases) * 100) : 0 };
    }),
    branches: branchRows.map((row: any) => ({ ...row, assigned: Number(row.assigned), approved: Number(row.approved), rejected: Number(row.rejected), pending: Number(row.pending), tat: Number(row.tat || 0) })),
    purposeBar: purposeRows.map((row: any) => ({ purpose: row.purpose, count: Number(row.count) })),
  };
};
