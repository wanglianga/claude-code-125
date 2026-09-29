import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '../../../../../lib/session';
import { one, q } from '../../../../../lib/db';
import { studentProgress } from '../../../../../lib/queries';
import { saveMeasurement, confirmOrder, payOrder, confirmSign, submitAftersale } from '../../../../../lib/actions/parent';
import { L, fmtMoney, fmtDT, label, SIZE_OPTIONS, SHOE_OPTIONS } from '../../../../../lib/util';
import { Badge, Msg, Steps } from '../../../../../components/ui';
import { buildSteps } from '../../../../../lib/steps';

const PART_PREFILL = { TOP: 'top_size', PANTS: 'pants_size', SKIRT: 'skirt_size', COAT: 'coat_size', SHOES: 'shoe_size', SET: 'top_size' };

function SizeInput({ name, defaultValue, shoes }) {
  return (
    <input list={shoes ? 'shoe-opts' : 'size-opts'} name={name} defaultValue={defaultValue || ''} placeholder="尺码" required style={{ width: 90 }} />
  );
}

export default async function ChildDetail({ params, searchParams }) {
  const user = await requireUser(['PARENT']);
  const studentId = Number(params.id);
  const stu = await one(
    `SELECT s.*, c.name AS class_name, cp.name AS campus_name FROM students s
     JOIN classes c ON c.id=s.class_id JOIN grades g ON g.id=c.grade_id JOIN campuses cp ON cp.id=g.campus_id
     WHERE s.id=? AND s.parent_id=?`, [studentId, user.id]);
  if (!stu) redirect('/parent?error=' + encodeURIComponent('学生不存在或无权查看'));
  const planId = Number(searchParams.plan);
  const plan = await one('SELECT * FROM order_plans WHERE id=?', [planId]);
  if (!plan) redirect('/parent');
  const back = `/parent/children/${stu.id}?plan=${plan.id}`;

  const prog = await studentProgress(plan.id, stu.id);
  const items = await q('SELECT * FROM plan_items WHERE plan_id=? ORDER BY id', [plan.id]);
  const orderItems = prog.order ? await q('SELECT * FROM order_items WHERE order_id=?', [prog.order.id]) : [];
  const payments = prog.order ? await q('SELECT * FROM payments WHERE order_id=? ORDER BY id DESC', [prog.order.id]) : [];
  const distRecords = prog.order
    ? await q(`SELECT dr.*, d.title, d.slot_start, d.location, d.type FROM distribution_records dr
               JOIN distributions d ON d.id=dr.distribution_id WHERE dr.order_id=? ORDER BY dr.id DESC`, [prog.order.id])
    : [];
  const canOrder = ['OPEN', 'FITTING', 'ORDERING'].includes(plan.status) && !prog.order && stu.status === 'ACTIVE';
  const m = prog.measurement;
  const f = prog.fitting;

  return (
    <>
      <div className="between">
        <div className="page-title">{stu.name} <span className="muted small">{stu.campus_name} · {stu.class_name}</span></div>
        <Link href="/parent" className="btn ghost sm">返回列表</Link>
      </div>
      <Msg searchParams={searchParams} />
      <datalist id="size-opts">{SIZE_OPTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="shoe-opts">{SHOE_OPTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      <div className="card">
        <h3>{plan.title} <span className="sub">{label(L.planStatus, plan.status)} · 缴费截止 {plan.pay_deadline || '待定'} · 贫困生减免 {plan.poverty_discount}%</span></h3>
        <Steps flags={buildSteps(prog)} />
      </div>

      {/* 1. 体型信息 */}
      <div className="card">
        <h3>① 学生体型信息 {m && <span className="sub">最近更新 {fmtDT(m.updated_at)}</span>}</h3>
        <form action={saveMeasurement}>
          <input type="hidden" name="student_id" value={stu.id} />
          <input type="hidden" name="plan_id" value={plan.id} />
          <input type="hidden" name="redirect_to" value={back} />
          <div className="form-grid">
            <div className="field"><label>身高（cm）</label><input name="height" type="number" step="0.1" defaultValue={m?.height} required /></div>
            <div className="field"><label>体重（kg）</label><input name="weight" type="number" step="0.1" defaultValue={m?.weight} required /></div>
            <div className="field"><label>常穿上衣尺码</label><input name="usual_top" defaultValue={m?.usual_top} placeholder="如 130" /></div>
            <div className="field"><label>常穿裤装尺码</label><input name="usual_bottom" defaultValue={m?.usual_bottom} placeholder="如 130" /></div>
            <div className="field"><label>常穿鞋码</label><input name="usual_shoes" defaultValue={m?.usual_shoes} placeholder="如 32" /></div>
            <div className="field">
              <label>特殊版型</label>
              <label className="flex small" style={{ marginTop: 8 }}>
                <input type="checkbox" name="special_fit" defaultChecked={!!m?.special_fit} style={{ width: 'auto' }} /> 需要特殊版型（偏胖/偏瘦等）
              </label>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>特殊需求说明</label><input name="special_note" defaultValue={m?.special_note} placeholder="如：偏瘦需收腰、皮肤过敏史等" /></div>
          </div>
          <div className="mt"><button className="btn sm">保存体型信息</button></div>
        </form>
      </div>

      {/* 2. 试穿结果 */}
      <div className="card">
        <h3>② 试穿结果</h3>
        {f ? (
          <div className="flex">
            <span>上衣 <b>{f.top_size || '—'}</b></span>
            <span>裤子 <b>{f.pants_size || '—'}</b></span>
            <span>裙装 <b>{f.skirt_size || '—'}</b></span>
            <span>外套 <b>{f.coat_size || '—'}</b></span>
            <span>鞋码 <b>{f.shoe_size || '—'}</b></span>
            {f.note && <span className="muted">备注：{f.note}</span>}
          </div>
        ) : (
          <div className="muted">试穿结果尚未录入，请等待班主任安排试穿。</div>
        )}
      </div>

      {/* 3. 确认订单 */}
      {canOrder && (
        <div className="card">
          <h3>③ 确认订单 <span className="sub">已按试穿建议预选尺码，可修改；增购件自选数量</span></h3>
          <form action={confirmOrder}>
            <input type="hidden" name="student_id" value={stu.id} />
            <input type="hidden" name="plan_id" value={plan.id} />
            <input type="hidden" name="redirect_to" value={back} />
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>项目</th><th>类别</th><th>单价</th><th>尺码</th><th>数量</th></tr></thead>
                <tbody>
                  {items.map((it) => {
                    const prefill = f ? f[PART_PREFILL[it.part]] : null;
                    return (
                      <tr key={it.id}>
                        <td>{it.name} {it.required ? <Badge text="必选" tone="info" /> : <Badge text="增购" tone="muted" />}</td>
                        <td>{label(L.category, it.category)}</td>
                        <td>{fmtMoney(it.price)}</td>
                        <td><SizeInput name={`size_${it.id}`} defaultValue={it.part === 'OTHER' ? '均码' : prefill} shoes={it.part === 'SHOES'} /></td>
                        <td>
                          {it.required ? '1' : (
                            <select name={`qty_${it.id}`} defaultValue="0" style={{ width: 70 }}>
                              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {stu.is_poverty && <div className="alert ok mt">贫困生减免：订单金额将自动减免 {plan.poverty_discount}%。</div>}
            <div className="mt"><button className="btn">确认订单</button></div>
          </form>
        </div>
      )}

      {/* 4. 订单与缴费 */}
      {prog.order && (
        <div className="card">
          <h3>③ 订单与缴费</h3>
          <div className="flex mb">
            <span>订单号 <Link href={`/orders/${prog.order.id}`}><b>{prog.order.order_no}</b></Link></span>
            <Badge text={label(L.orderStatus, prog.order.status)} />
            <Badge text={label(L.payStatus, prog.order.pay_status)} />
            {prog.order.is_late ? <Badge text="迟缴费" tone="danger" /> : null}
            <span>合计 {fmtMoney(prog.order.total_amount)}</span>
            {prog.order.discount_amount > 0 && <span className="muted">减免 {fmtMoney(prog.order.discount_amount)}</span>}
            <span>应缴 <b>{fmtMoney(prog.order.final_amount)}</b></span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>项目</th><th>类别</th><th>尺码</th><th>数量</th><th>单价</th></tr></thead>
              <tbody>
                {orderItems.map((oi) => (
                  <tr key={oi.id}>
                    <td>{oi.item_name}</td>
                    <td>{label(L.category, oi.category)}</td>
                    <td><b>{oi.size}</b></td>
                    <td>{oi.qty}</td>
                    <td>{fmtMoney(oi.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {prog.order.status === 'CONFIRMED' && prog.order.pay_status === 'UNPAID' && (
            <form action={payOrder} className="mt">
              <input type="hidden" name="order_id" value={prog.order.id} />
              <input type="hidden" name="redirect_to" value={back} />
              <button className="btn">立即缴费 {fmtMoney(prog.order.final_amount)}（模拟支付）</button>
              <span className="muted small" style={{ marginLeft: 8 }}>缴费截止 {plan.pay_deadline || '待定'}，逾期将记为迟缴费</span>
            </form>
          )}
          {payments.length > 0 && (
            <div className="mt small muted">
              缴费记录：{payments.map((p) => `${fmtDT(p.created_at)} ${p.type === 'PAY' ? '支付' : '退款'} ${fmtMoney(p.amount)}${p.remark ? `（${p.remark}）` : ''}`).join('；')}
            </div>
          )}
        </div>
      )}

      {/* 5. 发放签收 */}
      {distRecords.length > 0 && (
        <div className="card">
          <h3>④ 发放签收</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>场次</th><th>时间</th><th>地点</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {distRecords.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title} {r.type === 'MAKEUP' && <Badge text="补领" tone="warn" />}</td>
                    <td>{fmtDT(r.slot_start)}</td>
                    <td>{r.location || '—'}</td>
                    <td><Badge text={label(L.drStatus, r.status)} />{r.signed_by && <span className="muted small"> {r.signed_by}</span>}</td>
                    <td>
                      {r.status !== 'SIGNED' && (
                        <form action={confirmSign} className="inline">
                          <input type="hidden" name="record_id" value={r.id} />
                          <input type="hidden" name="redirect_to" value={back} />
                          <button className="btn sm">确认已领取</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. 售后 */}
      {prog.order && (
        <div className="card">
          <h3>⑤ 售后服务 <span className="sub">换码 / 补发 / 退款 / 投诉 / 面料过敏 / 错领调换</span></h3>
          {prog.tickets.length > 0 && (
            <div className="tbl-wrap mb">
              <table className="tbl">
                <thead><tr><th>工单号</th><th>类型</th><th>内容</th><th>状态</th><th>处理结果</th></tr></thead>
                <tbody>
                  {prog.tickets.map((t) => (
                    <tr key={t.id}>
                      <td className="nowrap">{t.ticket_no}</td>
                      <td>{label(L.asType, t.type)}</td>
                      <td>{t.item_desc || '—'}{t.from_size ? ` ${t.from_size}→${t.to_size || '?'}` : ''}</td>
                      <td><Badge text={label(L.asStatus, t.status)} /></td>
                      <td className="small">{t.resolution || '—'}{t.refund_amount ? `（退款 ${fmtMoney(t.refund_amount)}）` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form action={submitAftersale}>
            <input type="hidden" name="order_id" value={prog.order.id} />
            <input type="hidden" name="redirect_to" value={back} />
            <div className="form-grid">
              <div className="field">
                <label>售后类型</label>
                <select name="type">
                  {Object.entries(L.asType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="field">
                <label>涉及项目（换码必选）</label>
                <select name="order_item_id">
                  <option value="">— 整单/其他 —</option>
                  {orderItems.map((oi) => <option key={oi.id} value={oi.id}>{oi.item_name}（{oi.size}）</option>)}
                </select>
              </div>
              <div className="field"><label>原尺码</label><input name="from_size" placeholder="如 130" /></div>
              <div className="field"><label>期望尺码</label><input name="to_size" placeholder="如 140" /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>情况说明</label><textarea name="reason" required placeholder="请描述问题，如：孩子长高需换码 / 面料过敏红疹 / 包裹漏发等" /></div>
            </div>
            <div className="mt"><button className="btn sm">提交售后申请</button></div>
          </form>
        </div>
      )}
    </>
  );
}
