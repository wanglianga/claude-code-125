-- 种子数据：仅在空库时执行一次。__PWD_HASH__ 由 scripts/init-db.js 替换为 bcrypt('123456')
-- 覆盖场景：多校区、贫困生减免、毕业班补订、迟缴费、转学退款、分批发货、
--           分批发放/补领、换码/过敏/漏发/错领售后、供应商考核

INSERT INTO campuses (id, name) VALUES (1, '本部校区'), (2, '东校区');

INSERT INTO suppliers (id, name, contact, phone) VALUES
(1, '华美服饰有限公司', '刘经理', '13800000001'),
(2, '蓝天纺织科技', '张经理', '13800000002');

INSERT INTO users (id, username, password_hash, name, role, campus_id, supplier_id, phone) VALUES
(1,  'admin',    '__PWD_HASH__', '周主任', 'ADMIN',    1, NULL, '13900000001'),
(2,  'wang',     '__PWD_HASH__', '王芳',   'TEACHER',  1, NULL, '13900000002'),
(3,  'li',       '__PWD_HASH__', '李强',   'TEACHER',  1, NULL, '13900000003'),
(4,  'zhao',     '__PWD_HASH__', '赵敏',   'TEACHER',  1, NULL, '13900000004'),
(5,  'qian',     '__PWD_HASH__', '钱伟',   'TEACHER',  1, NULL, '13900000005'),
(6,  'sun',      '__PWD_HASH__', '孙丽',   'TEACHER',  2, NULL, '13900000006'),
(7,  'parent1',  '__PWD_HASH__', '林建国', 'PARENT', NULL, NULL, '13700000001'),
(8,  'parent2',  '__PWD_HASH__', '陈秀兰', 'PARENT', NULL, NULL, '13700000002'),
(9,  'parent3',  '__PWD_HASH__', '王强',   'PARENT', NULL, NULL, '13700000003'),
(10, 'parent4',  '__PWD_HASH__', '刘明',   'PARENT', NULL, NULL, '13700000004'),
(11, 'parent5',  '__PWD_HASH__', '张华',   'PARENT', NULL, NULL, '13700000005'),
(12, 'parent6',  '__PWD_HASH__', '赵刚',   'PARENT', NULL, NULL, '13700000006'),
(13, 'parent7',  '__PWD_HASH__', '孙燕',   'PARENT', NULL, NULL, '13700000007'),
(14, 'parent8',  '__PWD_HASH__', '周涛',   'PARENT', NULL, NULL, '13700000008'),
(15, 'parent9',  '__PWD_HASH__', '郑成功', 'PARENT', NULL, NULL, '13700000009'),
(16, 'parent10', '__PWD_HASH__', '何兵',   'PARENT', NULL, NULL, '13700000010'),
(17, 'parent11', '__PWD_HASH__', '高峰',   'PARENT', NULL, NULL, '13700000011'),
(18, 'parent12', '__PWD_HASH__', '罗红',   'PARENT', NULL, NULL, '13700000012'),
(19, 'parent13', '__PWD_HASH__', '马军',   'PARENT', NULL, NULL, '13700000013'),
(20, 'supplier1','__PWD_HASH__', '刘经理', 'SUPPLIER', NULL, 1, '13800000001'),
(21, 'supplier2','__PWD_HASH__', '张经理', 'SUPPLIER', NULL, 2, '13800000002'),
(22, 'factory1', '__PWD_HASH__', '陈厂长', 'FACTORY', NULL, NULL, '13800000003'),
(23, 'service1', '__PWD_HASH__', '小陈',   'SERVICE', NULL, NULL, '13800000004');

INSERT INTO grades (id, campus_id, name, is_graduating) VALUES
(1, 1, '一年级', 0), (2, 1, '二年级', 0), (3, 1, '六年级', 1), (4, 2, '一年级', 0);

INSERT INTO classes (id, grade_id, name, teacher_id) VALUES
(1, 1, '一年级(1)班', 2),
(2, 1, '一年级(2)班', 3),
(3, 2, '二年级(1)班', 4),
(4, 3, '六年级(3)班', 5),
(5, 4, '一年级(1)班', 6);

INSERT INTO students (id, class_id, student_no, name, gender, parent_id, is_poverty, status) VALUES
(1,  1, 'S2026001', '林小宇', '男', 7,  0, 'ACTIVE'),
(2,  1, 'S2026002', '陈思思', '女', 8,  1, 'ACTIVE'),
(3,  1, 'S2026003', '王一鸣', '男', 9,  0, 'ACTIVE'),
(4,  2, 'S2026004', '刘欣然', '女', 10, 0, 'ACTIVE'),
(5,  2, 'S2026005', '张浩然', '男', 11, 0, 'ACTIVE'),
(6,  3, 'S2026006', '赵子涵', '男', 12, 0, 'ACTIVE'),
(7,  3, 'S2026007', '孙雅婷', '女', 13, 0, 'ACTIVE'),
(8,  4, 'S2026008', '周俊杰', '男', 14, 0, 'ACTIVE'),
(9,  5, 'S2026009', '吴小雨', '女', 7,  0, 'ACTIVE'),
(10, 5, 'S2026010', '郑凯文', '男', 15, 0, 'ACTIVE'),
(11, 1, 'S2026011', '何佳佳', '女', 16, 0, 'ACTIVE'),
(12, 3, 'S2026012', '高子轩', '男', 17, 0, 'ACTIVE'),
(13, 4, 'S2026013', '罗一诺', '女', 18, 0, 'ACTIVE'),
(14, 5, 'S2026014', '唐小宝', '男', 15, 0, 'ACTIVE'),
(15, 2, 'S2026015', '马小跳', '男', 19, 0, 'TRANSFERRED');

INSERT INTO order_plans (id, title, campus_id, season, status, pay_deadline, poverty_discount, remark, created_by) VALUES
(1, '2026年秋季校服订购（本部）', 1, '秋季', 'ORDERING', '2026-09-25', 50, '本部统一采购，含毕业班补订', 1),
(2, '2026年秋季校服订购（东校区）', 2, '秋季', 'OPEN', '2026-10-20', 50, '东校区首批订购', 1);

INSERT INTO plan_classes (plan_id, class_id) VALUES
(1,1),(1,2),(1,3),(1,4),(2,5);

INSERT INTO plan_items (id, plan_id, name, category, part, price, required) VALUES
(1, 1, '秋季套装上衣', 'SUIT',   'TOP',   80.00,  1),
(2, 1, '秋季套装长裤', 'SUIT',   'PANTS', 60.00,  1),
(3, 1, '运动服套装',   'SPORT',  'SET',   100.00, 1),
(4, 1, '礼服外套',     'FORMAL', 'COAT',  120.00, 1),
(5, 1, '百褶裙',       'FORMAL', 'SKIRT', 50.00,  0),
(6, 1, '白色运动鞋',   'EXTRA',  'SHOES', 90.00,  0),
(7, 1, '红领巾(增购)', 'EXTRA',  'OTHER', 5.00,   0),
(8, 2, '秋季套装上衣', 'SUIT',   'TOP',   80.00,  1),
(9, 2, '秋季套装长裤', 'SUIT',   'PANTS', 60.00,  1),
(10,2, '运动服套装',   'SPORT',  'SET',   100.00, 1),
(11,2, '礼服外套',     'FORMAL', 'COAT',  120.00, 1),
(12,2, '百褶裙',       'FORMAL', 'SKIRT', 50.00,  0),
(13,2, '白色运动鞋',   'EXTRA',  'SHOES', 90.00,  0),
(14,2, '红领巾(增购)', 'EXTRA',  'OTHER', 5.00,   0);

INSERT INTO measurements (student_id, plan_id, height, weight, usual_top, usual_bottom, usual_shoes, special_fit, special_note) VALUES
(1,  1, 128, 25, '130', '130', '32', 0, NULL),
(2,  1, 125, 23, '130', '130', '31', 1, '偏瘦，需收腰版型'),
(3,  1, 135, 32, '140', '140', '33', 0, NULL),
(4,  1, 130, 26, '130', '130', '32', 0, NULL),
(5,  1, 138, 36, '140', '140', '34', 1, '偏胖，需加肥版'),
(6,  1, 140, 35, '140', '140', '34', 0, NULL),
(7,  1, 138, 32, '140', '140', '33', 0, NULL),
(11, 1, 126, 22, '130', '130', '31', 0, NULL),
(12, 1, 145, 40, '150', '150', '35', 0, NULL),
(9,  2, 127, 24, '130', '130', '31', 0, NULL);

INSERT INTO fitting_sessions (id, plan_id, class_id, slot_start, slot_end, location, created_by) VALUES
(1, 1, 1, '2026-09-20 09:00:00', '2026-09-20 10:00:00', '本部体育馆', 2),
(2, 1, 2, '2026-09-20 10:00:00', '2026-09-20 11:00:00', '本部体育馆', 3),
(3, 1, 3, '2026-09-21 09:00:00', '2026-09-21 10:00:00', '本部体育馆', 4);

INSERT INTO fitting_records (session_id, student_id, staff_id, top_size, pants_size, skirt_size, coat_size, shoe_size, note) VALUES
(1, 1,  2, '130', '130', NULL,  '130', '32', NULL),
(1, 2,  2, '130', '130', '130', '130', '31', '收腰版型'),
(1, 3,  2, '140', '140', NULL,  '140', '33', NULL),
(1, 11, 2, '130', '130', '130', '130', '31', NULL),
(2, 4,  3, '130', '130', '130', '130', '32', NULL),
(2, 5,  3, '140', '150', NULL,  '140', '34', '裤子加肥'),
(3, 6,  4, '140', '140', NULL,  '140', '34', NULL),
(3, 7,  4, '140', '140', '140', '140', '33', NULL),
(3, 12, 4, '150', '150', NULL,  '150', '35', NULL);

INSERT INTO production_batches (id, batch_no, plan_id, supplier_id, status, expected_arrival, note) VALUES
(1, 'B2026-0001', 1, 1, 'IN_PRODUCTION', '2026-10-10', '本部首批：一年级1班、2班与二年级1班已缴费订单');

INSERT INTO orders (id, order_no, plan_id, student_id, parent_id, batch_id, status, total_amount, discount_amount, final_amount, pay_status, paid_at, is_late, note, created_at) VALUES
(1,  'U2026-0001', 1, 1,  7,  1, 'CONFIRMED', 450.00, 0,      450.00, 'PAID',     '2026-09-22 10:00:00', 0, NULL, '2026-09-22 09:00:00'),
(2,  'U2026-0002', 1, 2,  8,  1, 'CONFIRMED', 410.00, 205.00, 205.00, 'PAID',     '2026-09-22 11:00:00', 0, '贫困生减免50%', '2026-09-22 10:30:00'),
(3,  'U2026-0003', 1, 3,  9,  NULL, 'CONFIRMED', 360.00, 0,   360.00, 'UNPAID',   NULL, 0, NULL, '2026-09-22 12:00:00'),
(4,  'U2026-0004', 1, 4,  10, 1, 'CONFIRMED', 450.00, 0,     450.00, 'PAID',     '2026-09-23 09:00:00', 0, NULL, '2026-09-23 08:00:00'),
(5,  'U2026-0005', 1, 5,  11, NULL, 'CONFIRMED', 360.00, 0,   360.00, 'PAID',     '2026-09-27 20:00:00', 1, '迟缴费：超过截止日2026-09-25', '2026-09-23 09:00:00'),
(6,  'U2026-0006', 1, 6,  12, 1, 'CONFIRMED', 360.00, 0,     360.00, 'PAID',     '2026-09-23 10:00:00', 0, NULL, '2026-09-23 09:30:00'),
(7,  'U2026-0007', 1, 7,  13, NULL, 'CONFIRMED', 410.00, 0,   410.00, 'UNPAID',   NULL, 0, NULL, '2026-09-23 11:00:00'),
(8,  'U2026-0008', 1, 8,  14, NULL, 'CONFIRMED', 140.00, 0,   140.00, 'PAID',     '2026-09-24 09:00:00', 0, '毕业班补订', '2026-09-24 08:30:00'),
(9,  'U2026-0009', 1, 12, 17, 1, 'CONFIRMED', 360.00, 0,     360.00, 'PAID',     '2026-09-24 10:00:00', 0, NULL, '2026-09-24 09:00:00'),
(10, 'U2026-0010', 1, 11, 16, 1, 'CONFIRMED', 415.00, 0,     415.00, 'PAID',     '2026-09-24 11:00:00', 0, NULL, '2026-09-24 10:00:00'),
(11, 'U2026-0011', 1, 15, 19, NULL, 'CANCELLED', 360.00, 0,   360.00, 'REFUNDED', '2026-09-23 15:00:00', 0, '学生转学，订单取消并全额退款', '2026-09-23 14:00:00');

INSERT INTO order_items (order_id, plan_item_id, item_name, category, part, size, qty, price) VALUES
(1, 1, '秋季套装上衣', 'SUIT', 'TOP', '130', 1, 80.00),
(1, 2, '秋季套装长裤', 'SUIT', 'PANTS', '130', 1, 60.00),
(1, 3, '运动服套装', 'SPORT', 'SET', '130', 1, 100.00),
(1, 4, '礼服外套', 'FORMAL', 'COAT', '130', 1, 120.00),
(1, 6, '白色运动鞋', 'EXTRA', 'SHOES', '32', 1, 90.00),
(2, 1, '秋季套装上衣', 'SUIT', 'TOP', '130', 1, 80.00),
(2, 2, '秋季套装长裤', 'SUIT', 'PANTS', '130', 1, 60.00),
(2, 3, '运动服套装', 'SPORT', 'SET', '130', 1, 100.00),
(2, 4, '礼服外套', 'FORMAL', 'COAT', '130', 1, 120.00),
(2, 5, '百褶裙', 'FORMAL', 'SKIRT', '130', 1, 50.00),
(3, 1, '秋季套装上衣', 'SUIT', 'TOP', '140', 1, 80.00),
(3, 2, '秋季套装长裤', 'SUIT', 'PANTS', '140', 1, 60.00),
(3, 3, '运动服套装', 'SPORT', 'SET', '140', 1, 100.00),
(3, 4, '礼服外套', 'FORMAL', 'COAT', '140', 1, 120.00),
(4, 1, '秋季套装上衣', 'SUIT', 'TOP', '130', 1, 80.00),
(4, 2, '秋季套装长裤', 'SUIT', 'PANTS', '130', 1, 60.00),
(4, 3, '运动服套装', 'SPORT', 'SET', '130', 1, 100.00),
(4, 4, '礼服外套', 'FORMAL', 'COAT', '130', 1, 120.00),
(4, 6, '白色运动鞋', 'EXTRA', 'SHOES', '32', 1, 90.00),
(5, 1, '秋季套装上衣', 'SUIT', 'TOP', '140', 1, 80.00),
(5, 2, '秋季套装长裤', 'SUIT', 'PANTS', '150', 1, 60.00),
(5, 3, '运动服套装', 'SPORT', 'SET', '140', 1, 100.00),
(5, 4, '礼服外套', 'FORMAL', 'COAT', '140', 1, 120.00),
(6, 1, '秋季套装上衣', 'SUIT', 'TOP', '140', 1, 80.00),
(6, 2, '秋季套装长裤', 'SUIT', 'PANTS', '140', 1, 60.00),
(6, 3, '运动服套装', 'SPORT', 'SET', '140', 1, 100.00),
(6, 4, '礼服外套', 'FORMAL', 'COAT', '140', 1, 120.00),
(7, 1, '秋季套装上衣', 'SUIT', 'TOP', '140', 1, 80.00),
(7, 2, '秋季套装长裤', 'SUIT', 'PANTS', '140', 1, 60.00),
(7, 3, '运动服套装', 'SPORT', 'SET', '140', 1, 100.00),
(7, 4, '礼服外套', 'FORMAL', 'COAT', '140', 1, 120.00),
(7, 5, '百褶裙', 'FORMAL', 'SKIRT', '140', 1, 50.00),
(8, 1, '秋季套装上衣', 'SUIT', 'TOP', '160', 1, 80.00),
(8, 2, '秋季套装长裤', 'SUIT', 'PANTS', '160', 1, 60.00),
(9, 1, '秋季套装上衣', 'SUIT', 'TOP', '150', 1, 80.00),
(9, 2, '秋季套装长裤', 'SUIT', 'PANTS', '150', 1, 60.00),
(9, 3, '运动服套装', 'SPORT', 'SET', '150', 1, 100.00),
(9, 4, '礼服外套', 'FORMAL', 'COAT', '150', 1, 120.00),
(10, 1, '秋季套装上衣', 'SUIT', 'TOP', '130', 1, 80.00),
(10, 2, '秋季套装长裤', 'SUIT', 'PANTS', '130', 1, 60.00),
(10, 3, '运动服套装', 'SPORT', 'SET', '130', 1, 100.00),
(10, 4, '礼服外套', 'FORMAL', 'COAT', '130', 1, 120.00),
(10, 5, '百褶裙', 'FORMAL', 'SKIRT', '130', 1, 50.00),
(10, 7, '红领巾(增购)', 'EXTRA', 'OTHER', '均码', 1, 5.00),
(11, 1, '秋季套装上衣', 'SUIT', 'TOP', '140', 1, 80.00),
(11, 2, '秋季套装长裤', 'SUIT', 'PANTS', '140', 1, 60.00),
(11, 3, '运动服套装', 'SPORT', 'SET', '140', 1, 100.00),
(11, 4, '礼服外套', 'FORMAL', 'COAT', '140', 1, 120.00);

INSERT INTO payments (order_id, amount, type, method, operator_id, remark, created_at) VALUES
(1, 450.00, 'PAY', 'ONLINE', 7, NULL, '2026-09-22 10:00:00'),
(2, 205.00, 'PAY', 'ONLINE', 8, '贫困生减免后实缴', '2026-09-22 11:00:00'),
(4, 450.00, 'PAY', 'ONLINE', 10, NULL, '2026-09-23 09:00:00'),
(5, 360.00, 'PAY', 'ONLINE', 11, '迟缴费', '2026-09-27 20:00:00'),
(6, 360.00, 'PAY', 'ONLINE', 12, NULL, '2026-09-23 10:00:00'),
(8, 140.00, 'PAY', 'ONLINE', 14, '毕业班补订', '2026-09-24 09:00:00'),
(9, 360.00, 'PAY', 'ONLINE', 17, NULL, '2026-09-24 10:00:00'),
(10, 415.00, 'PAY', 'ONLINE', 16, NULL, '2026-09-24 11:00:00'),
(11, 360.00, 'PAY', 'ONLINE', 19, NULL, '2026-09-23 15:00:00'),
(11, 360.00, 'REFUND', 'ONLINE', 1, '学生转学，全额退款', '2026-09-26 10:00:00');

INSERT INTO shipments (id, shipment_no, batch_id, supplier_id, status, shipped_at, arrived_at, note) VALUES
(1, 'SH2026-0001', 1, 1, 'ARRIVED', '2026-09-25 08:00:00', '2026-09-27 09:00:00', '第一批：一年级1班部分订单'),
(2, 'SH2026-0002', 1, 1, 'PREPARING', NULL, NULL, '第二批：备货中');

INSERT INTO shipment_orders (shipment_id, order_id) VALUES
(1,1),(1,2),(1,4),(2,6),(2,9),(2,10);

INSERT INTO distributions (id, plan_id, class_id, title, slot_start, slot_end, location, type, status, created_by) VALUES
(1, 1, 1, '一年级(1)班第一批发放', '2026-09-28 14:00:00', '2026-09-28 15:00:00', '本部校门大厅', 'NORMAL', 'DONE', 1),
(2, 1, 1, '一年级(1)班补领专场', '2026-09-30 15:00:00', '2026-09-30 16:00:00', '本部总务处', 'MAKEUP', 'SCHEDULED', 1);

INSERT INTO distribution_records (distribution_id, order_id, student_id, status, signed_by, signed_at) VALUES
(1, 1, 1, 'SIGNED', '林建国', '2026-09-28 14:05:00'),
(1, 2, 2, 'SIGNED', '陈秀兰', '2026-09-28 14:08:00'),
(1, 4, 4, 'MISSED', NULL, NULL),
(2, 4, 4, 'PENDING', NULL, NULL);

INSERT INTO aftersales (id, ticket_no, order_id, order_item_id, student_id, type, item_desc, from_size, to_size, reason, status, handler_id, resolution, refund_amount, created_by, created_at) VALUES
(1, 'AS2026-0001', 1, 1, 1, 'EXCHANGE', '秋季套装上衣', '130', '140', '孩子近期长高较快，上衣偏紧，申请换大一码', 'SUBMITTED', NULL, NULL, NULL, 7, '2026-09-28 15:00:00'),
(2, 'AS2026-0002', 2, NULL, 2, 'ALLERGY', '礼服外套', NULL, NULL, '孩子穿礼服外套后手臂出现红疹，怀疑面料过敏，要求检测并处理', 'PROCESSING', 23, NULL, NULL, 8, '2026-09-28 16:00:00'),
(3, 'AS2026-0003', 4, NULL, 4, 'MISSING', '白色运动鞋', NULL, NULL, '到货清单含运动鞋，包裹内漏发', 'RESOLVED', 23, '工厂核实漏发，已安排补发，3日内到校', NULL, 10, '2026-09-28 14:30:00'),
(4, 'AS2026-0004', 6, NULL, 6, 'COMPLAINT', '礼服外套', NULL, NULL, '礼服外套线头较多，希望加强质检', 'APPROVED', 23, NULL, NULL, 12, '2026-09-28 17:00:00'),
(5, 'AS2026-0005', 4, NULL, 4, 'WRONG_PICKUP', '整套校服包', NULL, NULL, '发放现场与同名学生错领校服包，需调换', 'PROCESSING', 23, NULL, NULL, 10, '2026-09-28 15:30:00');

INSERT INTO supplier_assessments (supplier_id, batch_id, score_quality, score_timeliness, score_service, comment, created_by) VALUES
(1, 1, 4, 5, 4, '首批到货及时，个别包装破损，已提醒改进', 1);

INSERT INTO notifications (user_id, title, content, is_read, created_at) VALUES
(9,  '缴费提醒', '王一鸣的校服订单 U2026-0003 尚未缴费，缴费截止日为 2026-09-25，请尽快完成缴费。', 0, '2026-09-26 09:00:00'),
(13, '缴费提醒', '孙雅婷的校服订单 U2026-0007 尚未缴费，缴费截止日为 2026-09-25，请尽快完成缴费。', 0, '2026-09-26 09:00:00'),
(10, '补领通知', '刘欣然未在 9月28日 发放时段领取校服，请于 9月30日 15:00-16:00 到本部总务处补领。', 0, '2026-09-28 15:30:00'),
(7,  '签收成功', '林小宇的校服已签收，如有尺码问题可在7日内申请换码。', 1, '2026-09-28 14:06:00'),
(20, '新生产批次', '批次 B2026-0001 已下达贵司，请及时安排生产并在到货前分批发货。', 0, '2026-09-24 12:00:00'),
(2,  '发放完成提醒', '一年级(1)班第一批发放已完成，2人签收、1人未领，已自动安排补领专场。', 0, '2026-09-28 15:05:00');

INSERT INTO events (entity, entity_id, action, actor_id, actor_name, detail, created_at) VALUES
('ORDER', 1, 'ORDER_CONFIRMED', 7, '林建国', '家长确认订单 U2026-0001，金额 ¥450.00', '2026-09-22 09:00:00'),
('ORDER', 1, 'PAYMENT_PAID', 7, '林建国', '在线缴费 ¥450.00', '2026-09-22 10:00:00'),
('ORDER', 1, 'BATCH_ASSIGNED', 1, '周主任', '订单并入生产批次 B2026-0001', '2026-09-24 12:00:00'),
('ORDER', 1, 'SHIPMENT_ARRIVED', 20, '刘经理', '发货单 SH2026-0001 已到校', '2026-09-27 09:00:00'),
('ORDER', 1, 'DISTRIBUTION_SIGNED', 2, '王芳', '一年级(1)班第一批发放签收，签收人：林建国', '2026-09-28 14:05:00'),
('ORDER', 2, 'ORDER_CONFIRMED', 8, '陈秀兰', '家长确认订单 U2026-0002，贫困生减免 ¥205.00，实缴 ¥205.00', '2026-09-22 10:30:00'),
('ORDER', 2, 'PAYMENT_PAID', 8, '陈秀兰', '在线缴费 ¥205.00', '2026-09-22 11:00:00'),
('ORDER', 2, 'DISTRIBUTION_SIGNED', 2, '王芳', '一年级(1)班第一批发放签收，签收人：陈秀兰', '2026-09-28 14:08:00'),
('ORDER', 5, 'PAYMENT_LATE', 11, '张华', '迟缴费：超过截止日 2026-09-25 缴纳 ¥360.00', '2026-09-27 20:00:00'),
('ORDER', 11, 'ORDER_CANCELLED', 1, '周主任', '学生马小跳转学，订单取消', '2026-09-26 09:30:00'),
('ORDER', 11, 'PAYMENT_REFUND', 1, '周主任', '转学全额退款 ¥360.00', '2026-09-26 10:00:00'),
('AFTERSALE', 3, 'RESOLVED', 23, '小陈', '工厂核实漏发，已安排补发，3日内到校', '2026-09-28 18:00:00');
