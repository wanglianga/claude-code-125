import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '../../../../../lib/session';
import { one, q } from '../../../../../lib/db';
import { planClassProgress, planStudentProgress, planReadiness } from '../../../../../lib/queries';
import { addPlanItem, deletePlanItem, updatePlanStatus, createBatch, sendPayReminders } from '../../../../../lib/actions/admin';
import { L, fmtMoney, label } from '../../../../../lib/util';
import { Badge, Msg } from '../../../../../components/ui';

export default async function PlanDetail({ params, searchParams }) {
  await requireUser(['ADMIN']);
  const plan = await one(
    'SELECT p.*, c.name AS campus_name FROM order_plans p JOIN campuses c ON c.id=p.campus_id WHERE p.id=?',
    [params.id]);
  if (!plan) redirect('/admin/plans');
  const items = await q('SELECT * FROM plan_items WHERE plan_id=? ORDER BY id', [plan.id]);
  const classProgress = await planClassProgress(plan.id);
  const studentRows = await planStudentProgress(plan.id, searchParams.class ? Number(searchParams.class) : null);
  const readiness = await planReadiness(plan.id);
  const suppliers = await q('SELECT * FROM suppliers ORDER BY id');
  const batches = await q(
    `SELECT b.*, s.name AS supplier_name FROM production_batches b JOIN suppliers s ON s.id=b.supplier_id
     WHERE b.plan_id=? ORDER BY b.id DESC`, [plan.id]);
  const back = `/admin/plans/${plan.id}`;

  return (
    <>
      <div className="between">
        <div className="page-title">{plan.title}</div>
        <Link href="/admin/plans" className="btn ghost sm">返回计划列表</Link>
      </div>
      <Msg searchParams={searchParams} />

      <div className="card">
        <div className="flex">
          <Badge text={label(L.planStatus, plan.status)} />
          <span className="muted small">{plan.campus_name} · {plan.season} · 缴费截止 {plan.pay_deadline || '待定'} · 贫困生减免 {plan.poverty_discount}%</span>
          {plan.remark && <span className="muted small">备注：{plan.remark}</span>}
        </div>
        <form action={updatePlanStatus} className="flex mt">
          <input type="hidden" name="plan_id" value={plan.id} />
          <span className="small muted">阶段流转：</span>
          <select name="status" defaultValue={plan.status}>
            {Object.entries(L.planStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn sm ghost">更新阶段</button>
        </form>
      </div>

      <div className="card">
        <h3>校服项目（套装 / 运动服 / 礼服 / 增购件）</h3>
        <div className="tbl-wrap mb">
          <table className="tbl">
            <thead><tr><th>项目</th><th>类别</th><th>部位</th><th>单价</th><th>必选</th><th></th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.name}</td>
                  <td>{label(L.category, it.category)}</td>
                  <td>{label(L.part, it.part)}</td>
                  <td>{fmtMoney(it.price)}</td>
                  <td>{it.required ? '必选' : '增购'}</td>
                  <td>
                    <form action={deletePlanItem} className="inline">
                      <input type="hidden" name="plan_id" value={plan.id} />
                      <input type="hidden" name="item_id" value={it.id} />
                      <button className="btn sm gray">删除</button>
                    </form>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="muted">尚未配置项目</td></tr>}
            </tbody>
          </table>
        </div>
        <form action={addPlanItem}>
          <input type="hidden" name="plan_id" value={plan.id} />
          <div className="form-grid">
            <div className="field"><label>项目名称</label><input name="name" required placeholder="如：秋季套装上衣" /></div>
            <div className="field">
              <label>类别</label>
              <select name="category">{Object.entries(L.category).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
            <div className="field">
              <label>部位</label>
              <select name="part">{Object.entries(L.part).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
            <div className="field"><label>单价（元）</label><input name="price" type="number" step="0.01" min="0" required /></div>
            <div className="field">
              <label>必选</label>
              <label className="flex small" style={{ marginTop: 8 }}><input type="checkbox" name="required" defaultChecked style={{ width: 'auto' }} /> 必选项目</label>
            </div>
          </div>
          <div className="mt"><button className="btn sm">添加项目</button></div>
        </form>
      </div>

      <div className="card">
        <h3>班级进度汇总</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>班级</th><th>学生</th><th>填信息</th><th>试穿</th><th>确认订单</th><th>已缴费</th><th>入批次</th><th>已签收</th><th>售后中</th><th></th></tr>
            </thead>
            <tbody>
              {classProgress.map((c) => (
                <tr key={c.id}>
                  <td>{c.class_name}</td>
                  <td>{c.students}</td>
                  <td>{c.measured}</td>
                  <td>{c.fitted}</td>
                  <td>{c.ordered}</td>
                  <td>{c.paid}</td>
                  <td>{c.in_batch}</td>
                  <td>{c.signed}</td>
                  <td>{c.open_tickets > 0 ? <Badge text={c.open_tickets} tone="warn" /> : 0}</td>
                  <td><Link className="small" href={`${back}?class=${c.id}`}>学生明细</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>学生进度明细 {searchParams.class && <Link href={back} className="small">（显示全部班级）</Link>}</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>班级</th><th>学号</th><th>姓名</th><th>信息</th><th>试穿</th><th>订单</th><th>缴费</th><th>生产</th><th>发货</th><th>签收</th><th>售后</th></tr>
            </thead>
            <tbody>
              {studentRows.map((r) => (
                <tr key={r.student_id} style={r.student_status === 'TRANSFERRED' ? { opacity: 0.5 } : undefined}>
                  <td className="nowrap">{r.class_name}</td>
                  <td>{r.student_no}</td>
                  <td>
                    {r.student_name}
                    {r.is_poverty ? <Badge text="贫困生" tone="warn" /> : null}
                    {r.student_status === 'TRANSFERRED' ? <Badge text="转学" tone="muted" /> : null}
                  </td>
                  <td>{r.measured ? '✓' : '—'}</td>
                  <td>{r.fitted ? '✓' : '—'}</td>
                  <td>{r.order_id ? <Link href={`/orders/${r.order_id}`}>{r.order_no}</Link> : <span className="muted">未确认</span>}</td>
                  <td>
                    {r.order_id ? <Badge text={label(L.payStatus, r.pay_status)} /> : '—'}
                    {r.is_late ? <Badge text="迟缴" tone="danger" /> : null}
                  </td>
                  <td className="small">{r.batch_status ? label(L.batchStatus, r.batch_status) : '—'}</td>
                  <td className="small">{r.shipment_status ? label(L.shipmentStatus, r.shipment_status) : '—'}</td>
                  <td>{r.dist_status ? <Badge text={label(L.drStatus, r.dist_status)} /> : '—'}</td>
                  <td>{r.open_tickets > 0 ? <Badge text={r.open_tickets} tone="warn" /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>投产就绪情况 <span className="sub">供应商只能投产已确认且已缴费的订单</span></h3>
        <div className="grid cols-3">
          <div>
            <h3 className="small">✅ 可投产（{readiness.ready.length}）</h3>
            <ul className="small">
              {readiness.ready.map((o) => <li key={o.id}>{o.class_name} {o.student_name}（{o.order_no}）</li>)}
              {!readiness.ready.length && <li className="muted">无</li>}
            </ul>
          </div>
          <div>
            <h3 className="small">⛔ 未缴费不可投产（{readiness.unpaid.length}）</h3>
            <ul className="small">
              {readiness.unpaid.map((o) => <li key={o.id}>{o.class_name} {o.student_name}（{o.order_no}，{fmtMoney(o.final_amount)}）</li>)}
              {!readiness.unpaid.length && <li className="muted">无</li>}
            </ul>
            {readiness.unpaid.length > 0 && (
              <form action={sendPayReminders}>
                <input type="hidden" name="plan_id" value={plan.id} />
                <button className="btn sm ghost">一键催缴</button>
              </form>
            )}
          </div>
          <div>
            <h3 className="small">⛔ 未确认订单（{readiness.unconfirmed.length}）</h3>
            <ul className="small">
              {readiness.unconfirmed.map((s) => <li key={s.id}>{s.class_name} {s.student_name}{s.measured ? '' : '（未填信息）'}</li>)}
              {!readiness.unconfirmed.length && <li className="muted">无</li>}
            </ul>
          </div>
        </div>
        {readiness.ready.length > 0 && (
          <form action={createBatch} className="flex mt">
            <input type="hidden" name="plan_id" value={plan.id} />
            <span className="small">将 {readiness.ready.length} 笔可投产订单打包为生产批次，交给</span>
            <select name="supplier_id">{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <input name="note" placeholder="批次备注" style={{ width: 180 }} />
            <button className="btn sm">创建生产批次</button>
          </form>
        )}
      </div>

      <div className="card">
        <h3>生产批次</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>批次号</th><th>供应商</th><th>状态</th><th>预计到校</th><th></th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.batch_no}</td>
                  <td>{b.supplier_name}</td>
                  <td><Badge text={label(L.batchStatus, b.status)} /></td>
                  <td>{b.expected_arrival || '—'}</td>
                  <td><Link className="btn sm" href={`/admin/batches/${b.id}`}>详情</Link></td>
                </tr>
              ))}
              {batches.length === 0 && <tr><td colSpan={5} className="muted">尚未创建批次</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
