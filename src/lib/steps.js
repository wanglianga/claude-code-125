// 学生订单进度步骤（数据计算，供家长/班主任等页面复用）
export function buildSteps(p) {
  const paid = p.order && ['PAID', 'PARTIAL_REFUND'].includes(p.order.pay_status);
  const produced = p.batch && ['IN_PRODUCTION', 'PRODUCED', 'SHIPPING', 'ARRIVED'].includes(p.batch.status);
  const arrived = p.shipment?.status === 'ARRIVED' || (p.batch && p.batch.status === 'ARRIVED');
  const signed = p.dist?.status === 'SIGNED';
  const flags = [
    { label: '填写信息', done: !!p.measurement },
    { label: '试穿', done: !!p.fitting },
    { label: '确认订单', done: !!p.order },
    { label: '缴费', done: !!paid },
    { label: '工厂生产', done: !!produced },
    { label: '到校', done: !!arrived },
    { label: '签收', done: !!signed },
  ];
  const idx = flags.findIndex((f) => !f.done);
  if (idx >= 0) flags[idx].now = true;
  return flags;
}
