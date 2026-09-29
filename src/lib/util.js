// 枚举中文标签与通用工具
export const L = {
  role: { ADMIN: '学校总务', TEACHER: '班主任', PARENT: '家长', SUPPLIER: '供应商', FACTORY: '工厂', SERVICE: '售后客服' },
  planStatus: {
    DRAFT: '草稿', OPEN: '信息收集中', FITTING: '试穿中', ORDERING: '订购缴费中',
    PRODUCING: '生产中', DISTRIBUTING: '发放中', COMPLETED: '已完成', CLOSED: '已关闭',
  },
  category: { SUIT: '季节套装', SPORT: '运动服', FORMAL: '礼服', EXTRA: '增购件' },
  part: { TOP: '上衣', PANTS: '裤子', SKIRT: '裙装', COAT: '外套', SHOES: '鞋', SET: '套装', OTHER: '其他' },
  payStatus: { UNPAID: '未缴费', PAID: '已缴费', REFUNDED: '已退款', PARTIAL_REFUND: '部分退款' },
  orderStatus: { CONFIRMED: '已确认', CANCELLED: '已取消' },
  batchStatus: { PENDING: '待投产', IN_PRODUCTION: '生产中', PRODUCED: '生产完成', SHIPPING: '发货中', ARRIVED: '已到校', CLOSED: '已结单' },
  shipmentStatus: { PREPARING: '备货中', SHIPPED: '运输中', ARRIVED: '已到校' },
  distStatus: { SCHEDULED: '已排期', DONE: '已完成', CANCELLED: '已取消' },
  distType: { NORMAL: '正常发放', MAKEUP: '补领专场' },
  drStatus: { PENDING: '待领取', SIGNED: '已签收', MISSED: '未领取' },
  asType: {
    EXCHANGE: '换码', REISSUE: '补发', REFUND: '退款', COMPLAINT: '投诉',
    ALLERGY: '面料过敏', WRONG_PICKUP: '错领调换', MISSING: '漏发补发',
  },
  asStatus: { SUBMITTED: '待受理', PROCESSING: '处理中', APPROVED: '已核准', REJECTED: '已驳回', RESOLVED: '已解决', CLOSED: '已关闭' },
  studentStatus: { ACTIVE: '在校', TRANSFERRED: '已转学' },
};

export const SIZE_OPTIONS = ['120', '130', '140', '150', '160', '170', '180', 'S', 'M', 'L', 'XL', '均码'];
export const SHOE_OPTIONS = ['28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40'];

export function fmtMoney(n) {
  return `¥${Number(n || 0).toFixed(2)}`;
}

export function fmtDT(s) {
  if (!s) return '—';
  return String(s).slice(0, 16);
}

export function fmtDate(s) {
  if (!s) return '—';
  return String(s).slice(0, 10);
}

// 徽标颜色（配合 globals.css）
export const TONE = {
  UNPAID: 'warn', PAID: 'ok', REFUNDED: 'muted', PARTIAL_REFUND: 'warn',
  DRAFT: 'muted', OPEN: 'info', FITTING: 'info', ORDERING: 'info', PRODUCING: 'warn',
  DISTRIBUTING: 'warn', COMPLETED: 'ok', CLOSED: 'muted',
  PENDING: 'muted', IN_PRODUCTION: 'warn', PRODUCED: 'info', SHIPPING: 'warn', ARRIVED: 'ok',
  PREPARING: 'muted', SHIPPED: 'warn',
  SCHEDULED: 'info', DONE: 'ok', CANCELLED: 'muted',
  SIGNED: 'ok', MISSED: 'danger',
  SUBMITTED: 'warn', PROCESSING: 'info', APPROVED: 'ok', REJECTED: 'danger', RESOLVED: 'ok',
  CONFIRMED: 'ok', ACTIVE: 'ok', TRANSFERRED: 'muted',
  NORMAL: 'info', MAKEUP: 'warn',
};

export function label(map, key) {
  return map[key] || key || '—';
}
