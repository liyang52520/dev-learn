(function () {
  'use strict';

  var QS = window.LEARN_QUESTIONS || [];
  var LEARNING = 'windows怎么安装opencode tui';

  var CHATS = [
    { t: '周报怎么写显得有产出', q: '这周感觉自己没干什么，周报怎么写', a: '周报的重点不是罗列动作，而是让阅读的人看到结果和下一步。\n### 可以按这个结构\n- 本周完成：写结果，不写「参与了」。\n- 数据变化：能量化就量化，比如接口耗时、转化率。\n- 问题与风险：需要谁配合，什么时候要。\n- 下周计划：只写三件最重要的事。\n如果确实没有产出，就写清楚在推进什么、卡在哪、需要什么支持，比硬凑内容更可信。' },
    { t: '正则提取手机号', q: '想从一段文本里把手机号提取出来，正则怎么写', a: '国内手机号可以用 `1[3-9]\\d{9}`。\n如果文本里混着别的数字，前后加边界更稳：\n```\n(?<!\\d)1[3-9]\\d{9}(?!\\d)\n```\n真实业务还要考虑号段变化和输入里的空格、短横线，必要时先清洗再匹配。' },
    { t: '杭州两天怎么安排', q: '周末去杭州玩两天，怎么安排比较顺', a: '两天建议一天西湖，一天灵隐寺加龙井村，别贪多。\n### 第一天\n- 上午断桥、白堤，走到孤山。\n- 下午苏堤、花港观鱼。\n- 傍晚去湖滨看日落。\n### 第二天\n- 早上去灵隐寺，尽量赶开门。\n- 中午龙井村吃饭喝茶。\n- 下午返程。\n西湖边周末人多，能走路就别打车，地铁加共享单车更省时间。' },
    { t: 'Excel 合并多张表', q: 'Excel 里怎么把十几张结构一样的表合成一张', a: '如果表头完全一致，用 Power Query 最省事：数据 → 获取数据 → 从文件 → 从文件夹，合并后自动追加。\n临时处理也可以直接复制粘贴，或者用 `VSTACK` 把多个区域纵向拼起来。\n关键是列名和顺序要统一，否则合并后会出现错列。' },
    { t: 'PPT 排版技巧', q: '做汇报 PPT 有什么排版技巧', a: '先定结构再排版，比一上来挑模板有效。\n- 一页只讲一个结论，标题直接写结论。\n- 正文控制在一屏能读完，字号不小于 18。\n- 颜色不超过三种，强调只留一个重点。\n- 图表优先于大段文字。\n模板选干净的就行，别用太多装饰和动画。' },
    { t: '租房合同注意什么', q: '第一次租房，合同里要注意哪些条款', a: '重点看钱、退和修三件事。\n- 押金怎么退，什么情况会扣。\n- 提前退租的违约金怎么算。\n- 家电损坏谁负责维修。\n- 水电燃气是民用还是商用价格。\n签约前拍照留底，把房屋现状写进合同附件，转账备注写「房租」。' },
    { t: '给娃取名字', q: '给小孩取名有什么思路', a: '可以先定一个方向，再从方向里挑字。\n- 从诗词里取，注意不要用太生僻的字。\n- 从家族字辈里取，兼顾读音。\n- 把姓和名连起来多读几遍，避免谐音。\n最后用输入法打一下，看看会不会总被联想成别的词。' },
    { t: '五一自驾去哪人少', q: '五一自驾，想找人少一点的地方', a: '五一热门景区基本都挤，思路是避开核心景点，选周边小城。\n- 车程控制在三小时以内，减少堵车消耗。\n- 住县城或小镇，景点选非网红的那几个。\n- 早上早出发，午饭提前或延后。\n提前看高速拥堵预测，能错峰就错峰。' },
    { t: '露营装备清单', q: '第一次露营需要准备什么', a: '先租一次再决定买什么，能省不少钱。\n### 基础装备\n- 帐篷、防潮垫、睡袋。\n- 折叠桌、椅子、照明。\n- 炉具和餐具，注意营地是否允许明火。\n- 防晒、防蚊、垃圾袋。\n第一次别去太偏的地方，选有厕所和水源的成熟营地。' },
    { t: '英文邮件写得客气', q: '给外国同事写邮件，怎么表达得客气一点', a: '客气主要靠句式和铺垫，不是堆 please。\n- 开头：Hope you are doing well.\n- 提请求：Would it be possible for you to ...?\n- 催进度：Just following up on ...\n- 结尾：Thanks for your help.\n句子短一点，一件事一封邮件，比长邮件更显得专业。' },
    { t: '一周三练怎么安排', q: '一周只能去三次健身房，怎么安排', a: '三次训练可以按推、拉、腿来分，或者全身训练各一次。\n- 每次先做复合动作，再做孤立动作。\n- 每个动作三到四组，留一点余力。\n- 两次训练之间至少隔一天。\n睡眠和饮食比多练一组更重要，别一上来就上大重量。' },
    { t: '路由器老是断网', q: '家里 WiFi 总是断，可能是什么原因', a: '先分清是宽带断了还是 WiFi 断了。\n### 排查顺序\n- 看光猫指示灯，LOS 红灯是线路问题。\n- 有线直连是否正常，排除运营商。\n- 路由器位置是否被墙和金属挡住。\n- 2.4G 和 5G 分开连，减少干扰。\n用了几年没重启的路由器，先恢复出厂再重新配置试试。' },
    { t: '体检报告指标偏高', q: '体检报告有几项指标偏高，严重吗', a: '单项轻度偏高不一定有问题，先看趋势和组合。\n- 血脂、尿酸、转氨酶这类指标受饮食和作息影响大。\n- 对比前几年的报告，看是偶发还是持续。\n- 有症状或明显超标，去医院复查，别只看体检结论。\n体检报告只是筛查，不能替代诊断。' },
    { t: '手机套餐怎么选', q: '手机套餐怎么选比较划算', a: '先把用量看清楚，再选套餐。\n- 查近三个月流量和通话的实际使用量。\n- 注意套餐外流量单价和限速规则。\n- 宽带和手机号绑定通常更便宜。\n不要只看首月优惠，算一年总价。' },
    { t: '春节回家抢票', q: '春节回家的票怎么抢成功率高一点', a: '提前看好放票时间，把乘车人信息先填好。\n- 用候补功能，比反复刷新靠谱。\n- 分段买票，长区间没票可以拆成两段。\n- 关注临客和夜间车次。\n- 接受换乘，成功率会高很多。\n别把希望放在第三方加速包上。' },
    { t: '油车还是电车', q: '买车选油车还是电车', a: '先看用车场景，不用先看参数。\n- 有固定车位能装充电桩、市区通勤多，电车更省。\n- 经常跑长途、没有充电条件，油车或混动更省心。\n- 北方冬天要注意续航打折。\n把保险、保养、折旧一起算，别只比电价和油价。' },
    { t: '搬家怎么打包', q: '搬家怎么打包不容易碎', a: '分三类打包：衣物、日用品、易碎品。\n- 易碎品用气泡膜，箱子里留空隙。\n- 每个箱子外面写房间和物品清单。\n- 证件、充电器、洗漱用品单独一个箱，最后装车。\n重物放小箱，书别装太满。' },
    { t: '周末电影推荐', q: '周末想在家看两部电影，有推荐吗', a: '看你想要什么情绪。\n- 想放松：选节奏轻的喜剧或动画。\n- 想投入：选悬疑或剧情片，最好一次看完。\n- 想陪家人：选口碑稳定的家庭片。\n别一次排太多，两部刚好，中间留点休息时间。' },
    { t: '简历怎么改', q: '简历投出去没什么回应，怎么改', a: '先让简历和岗位对上。\n- 项目写清楚你负责什么、怎么做的、结果如何。\n- 技术栈放在显眼位置，别藏在段落里。\n- 一页能放下就一页，删掉无关经历。\n- 量化结果，但别编数字。\n投之前对着 JD 改关键词，比海投有效。' },
    { t: 'Spring Bean 生命周期', q: 'Spring Bean 的生命周期是怎样的？', a: '先说结论：单例 Bean 的生命周期由容器完整托管，核心可以记成「实例化 → 属性填充 → 初始化 → 使用 → 销毁」。\n### 关键阶段\n- 实例化：反射调用构造器创建对象。\n- 属性填充：注入依赖，处理循环依赖时可能提前暴露三级缓存。\n- 初始化：执行 `Aware` 回调、`BeanPostProcessor#before`、`afterPropertiesSet`、自定义 `init-method`。\n- 销毁：容器关闭时执行 `DisposableBean` 和 `destroy-method`。\n### 容易忽略的点\n`BeanPostProcessor` 在初始化前后各执行一次，AOP 代理通常就在 `postProcessAfterInitialization` 阶段生成。' },
    { t: 'MySQL 索引失效场景', q: 'MySQL 索引在哪些情况下会失效？', a: '索引失效不是「索引没用」，而是优化器判断走索引成本更高，或者 SQL 写法让索引无法被有效利用。\n### 常见场景\n- 在索引列上做函数或运算，例如 `where date(create_time) = 2026-01-01`。\n- 隐式类型转换，字符串列用数字比较。\n- 前导模糊匹配 `like %abc`。\n- 联合索引不满足最左前缀。\n- `or` 连接的两列没有都建索引。\n排查时优先看 `explain` 的 `type`、`key`、`rows` 和 `Extra`，不要只凭感觉。' },
    { t: 'Redis 缓存穿透与雪崩', q: '缓存穿透、击穿和雪崩分别怎么处理？', a: '这三个问题经常一起问，但成因不同。\n### 缓存穿透\n请求的数据在缓存和数据库都不存在，压力直接打到数据库。常用方案是缓存空值、布隆过滤器、参数校验。\n### 缓存击穿\n单个热点 key 过期瞬间被大量并发访问，可以用互斥锁或逻辑过期。\n### 缓存雪崩\n大量 key 在同一时间过期，或者 Redis 整体不可用。解决思路是过期时间加随机值、热点数据永不过期、集群高可用和降级限流。' },
    { t: 'JVM 内存区域划分', q: 'JVM 运行时数据区是怎么划分的？', a: '以 HotSpot 为例，运行时数据区可以分为线程私有和线程共享两类。\n### 线程私有\n- 程序计数器：记录当前字节码执行位置。\n- 虚拟机栈：方法调用对应的栈帧。\n- 本地方法栈：服务 native 方法。\n### 线程共享\n- 堆：对象实例的主要存放区域，也是 GC 的主战场。\n- 方法区：JDK 8 之后由元空间实现，存放类元信息、常量、静态变量等。\n另外还有直接内存，不属于运行时数据区，但 NIO 会用到。' },
    { t: 'ThreadLocal 内存泄漏', q: 'ThreadLocal 为什么会有内存泄漏风险？', a: '`ThreadLocal` 本身不会泄漏，问题出在 `ThreadLocalMap` 的 Entry 对 key 是弱引用、对 value 是强引用。\n当 ThreadLocal 对象被回收后，key 变成 null，但 value 仍被线程强引用。线程池里的线程长期存活，这些 value 就堆积起来。\n### 正确做法\n- 使用完在 `finally` 里调用 `remove()`。\n- 不要用静态 ThreadLocal 存大对象。\n- 线程池场景尤其要注意清理。' },
    { t: 'Kafka 消息重复消费', q: 'Kafka 为什么会重复消费，怎么解决？', a: 'Kafka 只保证分区内有序，默认语义是 at least once，所以重复消费无法完全避免，消费端必须做幂等。\n### 常见原因\n- 消费者处理完消息但 offset 未提交就重启。\n- rebalance 导致分区重新分配。\n- 网络超时后重试。\n### 处理方式\n用业务唯一键做去重表，或者让操作本身幂等，例如 `update ... where status = 0`。不要只依赖 offset。' },
    { t: 'HashMap 扩容机制', q: 'HashMap 的扩容过程是怎样的？', a: 'HashMap 默认容量 16，负载因子 0.75，元素数量超过阈值就扩容为原来的 2 倍。\nJDK 8 扩容时不再重新计算 hash，而是利用容量是 2 的幂这个特点，把节点分成低位链和高位链：`(e.hash & oldCap) == 0` 留在原位置，否则移动到「原位置 + oldCap」。\n这样既避免了 JDK 7 头插法形成的循环链，也减少了重新哈希的开销。' },
    { t: '线程池参数怎么配', q: '线程池的核心参数应该怎么设置？', a: '参数没有万能公式，要从任务类型和下游容量倒推。\n### 核心参数\n- `corePoolSize` / `maximumPoolSize`：常驻线程和最大线程。\n- `workQueue`：排队策略，`LinkedBlockingQueue` 容易把最大线程数架空。\n- `keepAliveTime`：非核心线程空闲回收时间。\n- 拒绝策略：决定了过载时是丢弃、抛异常还是由调用线程执行。\nCPU 密集型可以接近核数，IO 密集型可以适当放大，但一定要压测，并给队列和线程数设上限。' },
    { t: 'Docker 镜像分层原理', q: 'Docker 镜像为什么要分层？', a: '镜像由一层层只读文件系统叠加而成，每条 `RUN`、`COPY`、`ADD` 都会产生新层。\n容器启动时在最上面加一个可写层，写时复制，所以容器删除后数据也会丢失。\n### 优化建议\n- 把变化少的指令放前面，充分利用构建缓存。\n- 合并 `RUN` 减少层数。\n- 用多阶段构建减小最终镜像体积。' },
    { t: 'HTTPS 到底解决了什么', q: 'HTTPS 到底解决了什么问题？', a: 'HTTP 是明文传输，HTTPS 在 HTTP 和 TCP 之间加了 TLS。\nTLS 主要解决三件事：加密、身份认证、完整性校验。\n握手阶段通过非对称加密协商出对称密钥，后续数据传输用对称加密，兼顾安全和性能。\nHTTPS 并不是绝对安全，它依赖证书体系和客户端信任链。' },
    { t: '线上 CPU 飙高怎么查', q: 'Linux 上 CPU 飙高怎么定位？', a: '排查顺序是「定位进程 → 定位线程 → 定位代码」。\n- `top` 找到高 CPU 进程。\n- `top -Hp` 找到高 CPU 线程。\n- 把线程 id 转成十六进制，用 `jstack` 找对应栈。\n如果是 Java 应用，还要结合 GC 日志判断是不是频繁 Full GC。\n不要一上来就重启，先留现场。' }
  ];

  var TITLES = [LEARNING].concat(CHATS.map(function (c) { return c.t; }));

  var visible = document.querySelector('.ds-virtual-list-visible-items');
  var items = document.querySelector('.ds-virtual-list-items');
  var scroller = document.querySelector('.ds-virtual-list');
  var userTpl = document.querySelector('[data-virtual-list-item-key="1"]').cloneNode(true);
  var aiTpl = document.querySelector('[data-virtual-list-item-key="2"]').cloneNode(true);
  var codeTpl = aiTpl.querySelector('.md-code-block');
  var input = document.querySelector('textarea._27c9245');
  var sendBtn = document.querySelector('._52c986b');
  var attachBtn = document.querySelector('.f02f0e25');
  var sider = document.querySelector('.dc04ec1d');
  var collapseBtn = document.querySelector('._7d1f5e2');
  var shareBtn = document.querySelector('._57370c5');
  var titleNodes = document.querySelectorAll('.d00ed9c9, .e37a04e4');
  var state = { session: 0, phase: 'idle', qIndex: 2 };
  var SELFTEST = location.search.indexOf('selftest=1') !== -1;
  var review = {
    ready: false,
    loading: false,
    pending: null,
    cards: [],
    card: null,
    emptyNotified: false,
    clientId: 'disguise-' + Math.random().toString(36).slice(2, 12)
  };

  // 站点可能部署在子路径（如 /dev-learn/disguise/），接口要跟着前缀走
  var BASE = (function () {
    var i = location.pathname.indexOf('/disguise');
    return i === -1 ? '/' : location.pathname.slice(0, i + 1);
  })();

  function apiUrl(url) {
    return BASE + url.replace(/^\//, '');
  }

  // 失败时带上 status 与后端错误码，评分 409（卡片排队过期）需要单独处理
  function apiRequest(url, options) {
    return fetch(apiUrl(url), options).then(function (r) {
      if (r.ok) return r.json();
      return r.json().catch(function () { return {}; }).then(function (data) {
        var info = (data && data.error) || {};
        var err = new Error(info.message || 'http ' + r.status);
        err.status = r.status;
        err.code = info.code || '';
        throw err;
      });
    });
  }

  function apiGet(url) {
    return apiRequest(url, { credentials: 'same-origin' });
  }

  function apiPost(url, body) {
    return apiRequest(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  function loadQueue() {
    if (review.loading) return review.pending;
    review.loading = true;
    review.pending = apiGet('/api/review/queue?limit=5').then(function (data) {
      review.cards = data.cards || [];
      review.card = review.cards[0] || null;
      review.ready = true;
    }).catch(function () {
      review.ready = false;
    }).then(function () {
      review.loading = false;
    });
    return review.pending;
  }

  // 服务端只给卡片 30 分钟排队时间，超时评分会返回 409。
  // 重新取一次队列即可那张卡续期；找到就返回，没找到说明已被别处处理或已过期。
  function reloadCard(cardId) {
    return apiGet('/api/review/queue?limit=20').then(function (data) {
      review.ready = true;
      review.cards = data.cards || [];
      var found = null;
      review.cards.forEach(function (item) {
        if (item.cardId === cardId) found = item;
      });
      if (found) review.card = found;
      return found;
    }).catch(function () {
      return null;
    });
  }

  function cardTitle(card) {
    if (!card) return '';
    return card.question ? card.question.title : card.qid;
  }

  function notice(text) {
    append(aiNode('<p class="ds-markdown-paragraph">' + esc(text) + '</p>', false));
  }

  function notifyEmpty() {
    if (!review.ready || review.emptyNotified) return;
    review.emptyNotified = true;
    notice('今天的复习已经全部完成了，明天再来吧。');
  }

  var DEMO = [
    { me: true, text: 'windows怎么安装opencode tui' },
    { me: false, text: '在 Windows 上安装 OpenCode 的 TUI（终端界面）主要有以下几种方式。其中，**官方最推荐使用 WSL（Windows Subsystem for Linux）**，因为它能提供最佳的性能和完整的功能兼容性。\n### 方式一：通过 WSL 安装（官方推荐）\n这是在 Windows 上获得最完整、最稳定体验的方式。\n1. **安装 WSL**：如果尚未安装，请以管理员身份打开 PowerShell，运行 `wsl --install`，然后根据提示重启电脑。\n2. **进入 WSL 终端**：在开始菜单中打开安装好的 Linux 发行版（如 Ubuntu），或直接在终端输入 `wsl` 进入。\n3. **运行安装脚本**：在 WSL 终端中执行官方的一键安装脚本：\n```bash\ncurl -fsSL https://opencode.ai/install | bash\n```\n### 方式二：通过 npm 安装\n此方式需要你的 Windows 系统已安装 Node.js。\n```bash\nnpm install -g opencode-ai@latest\n```\n同样，安装后通过 `opencode` 命令启动。\n### 需要注意\n- **Bun 安装方式暂不完善**：官方文档指出，在 Windows 上通过 Bun 安装 OpenCode 的支持目前仍在开发中，因此暂时不推荐使用该方法。\n- **桌面版是另一种选择**：OpenCode 也提供了独立的桌面应用程序（.exe 安装包），其功能与 TUI 版完全一致。如果你更习惯图形化操作而非命令行，可以直接从官方 Releases 页面下载安装桌面版。\n安装完成后，首次运行 `opencode` 进入 TUI，通常需要输入 `/connect` 命令来连接 AI 模型提供商并配置你的 API 密钥。' },
    { me: true, text: '行，我先把 WSL 装上试试' },
    { me: false, text: '好，装完在 WSL 里运行 `opencode` 就行。需要继续看后面的配置，点输入框左边的附件，我按顺序往下讲。' }
  ];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function inline(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  // 复制到剪贴板：非安全上下文（http + 局域网 IP）没有 navigator.clipboard，退回 execCommand。
  function copyText(text, done) {
    function finish(ok) { if (done) done(ok); }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { finish(true); }, function () { finish(legacyCopy(text)); });
      return;
    }
    finish(legacyCopy(text));
  }

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function codeBlock(text, lang) {
    if (!codeTpl) return '<pre><code>' + esc(text) + '</code></pre>';
    var node = codeTpl.cloneNode(true);
    var pre = node.querySelector('pre');
    if (pre) pre.innerHTML = text.split('\n').map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('\n');
    var label = node.querySelector('.d813de27');
    if (label) label.textContent = lang || 'text';
    // 模板里的复制按钮是 DeepSeek 自己的 div.ds-button，没有点击逻辑，补上标记交给事件委托
    var copyLabel = node.querySelector('.code-info-button-text');
    var copyBtn = copyLabel && copyLabel.closest ? copyLabel.closest('.ds-button') : null;
    if (copyBtn) copyBtn.setAttribute('data-code-copy', '');
    return node.outerHTML;
  }

  function md(src) {
    var lines = String(src).split('\n'), out = [], para = [], list = null, code = null;
    function flushPara() {
      if (para.length) { out.push('<p class="ds-markdown-paragraph">' + inline(para.join(' ')) + '</p>'); para = []; }
    }
    function flushList() {
      if (list) { out.push('<' + list.tag + '>' + list.items.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</' + list.tag + '>'); list = null; }
    }
    function pushItem(tag, text) {
      flushPara();
      if (!list || list.tag !== tag) { flushList(); list = { tag: tag, items: [] }; }
      list.items.push(text);
    }
    lines.forEach(function (line) {
      if (code) {
        if (/^```/.test(line)) { out.push(codeBlock(code.lines.join('\n'), code.lang)); code = null; }
        else code.lines.push(line);
        return;
      }
      if (/^```/.test(line)) { flushPara(); flushList(); code = { lang: line.replace(/^```/, '').trim(), lines: [] }; return; }
      if (/^###\s+/.test(line)) { flushPara(); flushList(); out.push('<h3>' + inline(line.replace(/^###\s+/, '')) + '</h3>'); return; }
      if (/^-\s+/.test(line)) { pushItem('ul', line.replace(/^-\s+/, '')); return; }
      if (/^\d+\.\s+/.test(line)) { pushItem('ol', line.replace(/^\d+\.\s+/, '')); return; }
      if (!line.trim()) { flushPara(); flushList(); return; }
      flushList(); para.push(line);
    });
    flushPara(); flushList();
    if (code) out.push(codeBlock(code.lines.join('\n'), code.lang));
    return out.join('');
  }

  function tagTips(root, labels) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('.ds-button'), function (b, i) {
      if (labels[i]) b.setAttribute('data-tip', labels[i]);
    });
  }

  function userNode(text) {
    var node = userTpl.cloneNode(true);
    node.removeAttribute('data-virtual-list-item-key');
    node.classList.add('disguise-user-msg');
    node.setAttribute('data-nav-title', text);
    node.querySelector('.ds-collapsible-text span').textContent = text;
    var actions = node.querySelector('._11d6b3a');
    if (actions) {
      tagTips(actions, ['复制', '编辑']);
      var buttons = actions.querySelectorAll('.ds-button');
      if (buttons[0]) {
        buttons[0].style.cursor = 'pointer';
        buttons[0].addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          copyText(text);
        });
      }
      if (buttons[1]) buttons[1].style.cursor = 'pointer';
    }
    return node;
  }

  function disclaimerNode() {
    var p = document.createElement('p');
    p.className = 'disguise-disclaimer';
    p.textContent = '本回答由 AI 生成，内容仅供参考，请仔细甄别';
    return p;
  }

  function aiNode(html, rate, labels, card, streaming) {
    var node = aiTpl.cloneNode(true);
    node.removeAttribute('data-virtual-list-item-key');
    var root = node.querySelector('._74c0879');
    var content = node.querySelector('.ds-assistant-message-main-content');
    var bar = node.querySelector('._0a3d93b');
    Array.prototype.slice.call(root.children).forEach(function (child) {
      if (child !== content && child !== bar) child.remove();
    });
    var sources = node.querySelector('.f93f59e4');
    if (sources) sources.remove();
    content.innerHTML = html;
    // 流式输出时免责声明与底部操作栏等整段说完再出现
    if (!streaming) content.appendChild(disclaimerNode());
    if (!bar) return node;
    bar.style.display = streaming ? 'none' : 'flex';
    var group = bar.querySelector('._965abe9');
    if (group) group.style.opacity = '1';
    if (!rate) {
      tagTips(bar, ['复制', '重新生成', '点赞', '点踩', '朗读', '分享']);
      return node;
    }
    bar.setAttribute('data-rated', '0');
    var buttons = bar.querySelectorAll('.ds-button');
    // 评分只绑定前四个按钮；后两个（朗读/分享）保留正常交互，其中最后一个可跳到题目编辑页
    var rateTips = ['忘记', '模糊', '记得', '简单'];
    [].slice.call(buttons, 0, 4).forEach(function (b, i) {
      var tip = rateTips[i] + (labels && labels[i] ? ' · 下次 ' + labels[i] : '');
      b.setAttribute('data-rate', String(i + 1));
      b.setAttribute('data-tip', tip);
      b.setAttribute('aria-label', tip);
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        selectRate(node, i);
      });
    });
    if (buttons[5] && card && card.qid) {
      var editTip = '编辑这道题';
      buttons[5].setAttribute('data-tip', editTip);
      buttons[5].setAttribute('aria-label', editTip);
      buttons[5].style.cursor = 'pointer';
      buttons[5].addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = editUrl(card.qid);
      });
    }
    return node;
  }

  function finishStream(node) {
    var content = node.querySelector('.ds-assistant-message-main-content');
    if (content && !content.querySelector('.disguise-disclaimer')) content.appendChild(disclaimerNode());
    var bar = node.querySelector('._0a3d93b');
    if (bar) bar.style.display = 'flex';
  }

  // QID 形如 <topicId>/<题号>，题库后台按 /admin/study?tab=bank&topic=&qid= 直接打开编辑器
  function editUrl(qid) {
    var parts = String(qid).split('/');
    var topicId = parts.shift() || '';
    return BASE + 'admin/study?tab=bank&topic=' + encodeURIComponent(topicId) +
      '&qid=' + encodeURIComponent(parts.join('/'));
  }

  function selectRate(node, index) {
    var bar = node.querySelector('._0a3d93b');
    if (!bar) return;
    if (bar.getAttribute('data-rated') === '1') return;
    var buttons = bar.querySelectorAll('.ds-button');
    Array.prototype.forEach.call(buttons, function (b, i) {
      b.classList.toggle('is-rated', i === index);
    });
    if (state.phase !== 'answered') return;
    var card = review.ready ? review.card : null;
    if (!card) {
      bar.setAttribute('data-rated', '1');
      state.phase = 'idle';
      state.qIndex = (state.qIndex + 1) % QS.length;
      syncSend();
      return;
    }
    bar.setAttribute('data-rated', '1');
    submitRating(bar, card, index + 1);
  }

  function resetRateBar(bar) {
    bar.setAttribute('data-rated', '0');
    Array.prototype.forEach.call(bar.querySelectorAll('.ds-button'), function (b) {
      b.classList.remove('is-rated');
    });
  }

  function submitRating(bar, card, rating, retried) {
    apiPost('/api/review/answer', {
      cardId: card.cardId,
      rating: rating,
      clientId: review.clientId
    }).then(function (data) {
      review.card = data.next || null;
      state.phase = 'idle';
      syncSend();
      if (!review.card) notifyEmpty();
    }).catch(function (err) {
      // 卡片排队超时（409）时重新取卡续期并自动补一次提交，用户不需要重复点击
      if (err && err.status === 409 && !retried) {
        reloadCard(card.cardId).then(function (found) {
          if (found) {
            submitRating(bar, found, rating, true);
            return;
          }
          resetRateBar(bar);
          review.card = review.cards[0] || null;
          state.phase = 'idle';
          syncSend();
          if (review.card) notice('这张卡已过期，请重新点附件抽题。');
          else notifyEmpty();
        });
        return;
      }
      resetRateBar(bar);
      notice('抱歉，这次评分没有提交成功，请再点一次。');
    });
  }

  var nav = document.createElement('div');
  nav.className = 'disguise-nav';
  nav.style.display = 'none';
  nav.innerHTML = '<div class="disguise-nav-bg"></div>' +
    '<div class="disguise-nav-panel"><div class="disguise-nav-list"></div></div>';
  var navList = nav.querySelector('.disguise-nav-list');
  document.body.appendChild(nav);

  function navMessages() {
    return Array.prototype.slice.call(visible.querySelectorAll('.disguise-user-msg'));
  }

  function setNavActive(index) {
    Array.prototype.forEach.call(navList.children, function (item, i) {
      item.classList.toggle('is-active', i === index);
    });
    revealNavItem(index);
  }

  // 高亮项如果跑出列表可视区（新提问不断追加时），把列表滚到能看见它的位置
  function revealNavItem(index) {
    var item = navList.children[index];
    if (!item) return;
    var listRect = navList.getBoundingClientRect();
    var rect = item.getBoundingClientRect();
    if (rect.top < listRect.top) navList.scrollTop -= listRect.top - rect.top;
    else if (rect.bottom > listRect.bottom) navList.scrollTop += rect.bottom - listRect.bottom;
  }

  var navLockUntil = 0;

  function updateNavActive() {
    if (nav.style.display === 'none') return;
    if (Date.now() < navLockUntil) return;
    var msgs = navMessages();
    if (!msgs.length) return;
    // 以视口中线为判定线：滚动经过下一条提问时才切换高亮
    var line = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.5;
    var index = 0;
    msgs.forEach(function (msg, i) {
      if (msg.getBoundingClientRect().top <= line) index = i;
    });
    setNavActive(index);
  }

  // 和官方一致：右侧快速跳转只列用户提问，两条以上才出现
  function syncNav() {
    var msgs = navMessages();
    nav.style.display = msgs.length >= 2 ? 'flex' : 'none';
    navList.innerHTML = '';
    if (msgs.length < 2) return;
    msgs.forEach(function (msg, i) {
      var item = document.createElement('div');
      item.className = 'disguise-nav-item';
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', msg.getAttribute('data-nav-title') || '');
      var title = document.createElement('div');
      title.className = 'disguise-nav-title';
      title.textContent = msg.getAttribute('data-nav-title') || '';
      var dash = document.createElement('div');
      dash.className = 'disguise-nav-dash';
      dash.innerHTML = '<i></i>';
      item.appendChild(title);
      item.appendChild(dash);
      item.addEventListener('click', function () {
        // 点击后先锁住滚动判定，避免平滑滚动过程把高亮改回上一项
        navLockUntil = Date.now() + 1000;
        setNavActive(i);
        msg.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      navList.appendChild(item);
    });
    if (Date.now() < navLockUntil) {
      setNavActive(msgs.length - 1);
    } else {
      updateNavActive();
    }
  }

  nav.addEventListener('mouseenter', function () { nav.classList.add('is-open'); });
  nav.addEventListener('mouseleave', function () { nav.classList.remove('is-open'); });

  var navTick = false;
  scroller.addEventListener('scroll', function () {
    if (navTick) return;
    navTick = true;
    requestAnimationFrame(function () {
      navTick = false;
      updateNavActive();
    });
  }, { passive: true });

  function append(node) {
    visible.appendChild(node);
    syncNav();
    requestAnimationFrame(function () {
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
        scroller.scrollLeft = 0;
      }
      updateNavActive();
    });
  }

  // ---- 流式输出 ----
  // 普通段落按时间逐字显示；代码块、图片、表格等整块直接出现，不做逐字动画。
  var streamSeq = 0;
  var stick = { on: true };
  if (scroller) {
    // 用户主动往上翻时停止自动跟随，滚回底部再恢复
    scroller.addEventListener('scroll', function () {
      stick.on = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
    }, { passive: true });
    scroller.addEventListener('wheel', function (e) {
      if (e.deltaY < 0) stick.on = false;
    }, { passive: true });
    scroller.addEventListener('touchmove', function () { stick.on = false; }, { passive: true });
  }

  function followScroll(force) {
    if (!scroller) return;
    if (force) stick.on = true;
    if (stick.on) scroller.scrollTop = scroller.scrollHeight;
  }

  function blockNodes(html) {
    var holder = document.createElement('div');
    holder.innerHTML = html;
    var out = [];
    Array.prototype.forEach.call(holder.childNodes, function (node) {
      if (node.nodeType === 1) { out.push(node); return; }
      if (node.nodeType === 3 && node.nodeValue.trim()) {
        var p = document.createElement('p');
        p.className = 'ds-markdown-paragraph';
        p.textContent = node.nodeValue;
        out.push(p);
      }
    });
    return out;
  }

  var WHOLE_SELECTOR = 'img,pre,table,svg,video,.code-block,.md-code-block,.table-wrap,.math-block';

  function isWholeBlock(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.matches && node.matches(WHOLE_SELECTOR)) return true;
    return !!(node.querySelector && node.querySelector(WHOLE_SELECTOR));
  }

  function collectTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var list = [];
    var total = 0;
    var node;
    while ((node = walker.nextNode())) {
      var full = node.nodeValue;
      list.push({ node: node, full: full, start: total });
      total += full.length;
      node.nodeValue = '';
    }
    return { list: list, total: total };
  }

  function revealText(list, shown) {
    list.forEach(function (item) {
      var len = shown - item.start;
      var value = len <= 0 ? '' : (len >= item.full.length ? item.full : item.full.slice(0, len));
      if (item.node.nodeValue !== value) item.node.nodeValue = value;
    });
  }

  function typeBlock(content, block, cps, token, done) {
    content.appendChild(block);
    var gather = collectTextNodes(block);
    if (!gather.total) { done(); return; }
    var t0 = 0;
    var shown = 0;
    function frame(now) {
      if (token !== streamSeq) return;
      if (!t0) t0 = now;
      var target = Math.min(gather.total, Math.floor((now - t0) * cps / 1000));
      if (target !== shown) {
        revealText(gather.list, target);
        shown = target;
        followScroll();
      }
      if (target < gather.total) requestAnimationFrame(frame);
      else done();
    }
    requestAnimationFrame(frame);
  }

  function streamAppend(html, rate, labels, card) {
    var token = ++streamSeq;
    var node = aiNode('', rate, labels, card, true);
    var content = node.querySelector('.ds-assistant-message-main-content');
    var blocks = blockNodes(html);
    var total = 0;
    blocks.forEach(function (b) {
      if (!isWholeBlock(b)) total += (b.textContent || '').length;
    });
    // 速度按整段文字量自适应：整体控制在 2.5~9 秒，短回答不拖沓，长回答不磨人
    var cps = Math.max(220, Math.min(700, total / 9));
    var index = 0;
    stick.on = true;
    append(node);
    function step() {
      if (token !== streamSeq) return;
      if (index >= blocks.length) {
        finishStream(node);
        followScroll();
        return;
      }
      var block = blocks[index++];
      if (isWholeBlock(block)) {
        content.appendChild(block);
        followScroll();
        window.setTimeout(step, 140);
        return;
      }
      typeBlock(content, block, cps, token, step);
    }
    step();
  }

  function render(session) {
    streamSeq++;
    state.session = session;
    state.phase = 'idle';
    visible.innerHTML = '';
    if (session === 0) {
      DEMO.forEach(function (m) {
        append(m.me ? userNode(m.text) : aiNode(md(m.text), false));
      });
    } else {
      var chat = CHATS[session - 1];
      append(userNode(chat.q));
      append(aiNode(md(chat.a), false));
    }
    input.value = '';
    syncSend();
  }

  function syncSend() {
    var hasText = !!input.value.trim();
    // 和官方一致：输入框有内容就点亮发送按钮（bd74640a 是页面自带的半透明空态样式）
    if (hasText) {
      sendBtn.classList.remove('ds-button--disabled');
      sendBtn.classList.remove('bd74640a');
    } else {
      sendBtn.classList.add('ds-button--disabled');
      sendBtn.classList.add('bd74640a');
    }
  }

  function submit() {
    var text = input.value.trim();
    if (!text) return;
    if (state.session === 0) {
      if (state.phase !== 'filled') return;
      input.value = '';
      syncSend();
      append(userNode(text));
      var card = review.ready ? review.card : null;
      state.phase = 'answered';
      if (!card) {
        var q = QS[state.qIndex];
        streamAppend(q.html, true);
      } else {
        apiGet('/api/review/card-answer?qid=' + encodeURIComponent(card.qid)).then(function (data) {
          streamAppend(data.answerHtml, true, card.labels, card);
          syncSend();
          // 这里失败（卡片排队过期）不额外处理：评分时会重新取卡续期再提交
          apiPost('/api/review/touch', { cardId: card.cardId }).catch(function () {});
        }).catch(function () {
          state.phase = 'idle';
          syncSend();
          notice('这道题的内容暂时取不到，请稍后再试。');
        });
      }
    } else {
      input.value = '';
      syncSend();
      append(userNode(text));
      append(aiNode('<p class="ds-markdown-paragraph">抱歉，服务暂时不可用，请稍后再试。</p>', false));
    }
    syncSend();
  }

  function onAttach(e) {
    e.preventDefault();
    e.stopPropagation();
    if (state.session !== 0 || state.phase !== 'idle') return;
    if (!SELFTEST && !review.ready && review.pending) {
      review.pending.then(fillQuestion);
      return;
    }
    if (!SELFTEST && !review.ready) {
      loadQueue().then(fillQuestion);
      return;
    }
    fillQuestion();
  }

  function fillQuestion() {
    if (state.session !== 0 || state.phase !== 'idle') return;
    if (review.ready) {
      if (!review.card) {
        notifyEmpty();
        return;
      }
      input.value = cardTitle(review.card);
    } else {
      if (!QS.length) return;
      input.value = QS[state.qIndex].title;
    }
    state.phase = 'filled';
    syncSend();
    input.focus();
  }

  var links = [];
  var groups = Array.prototype.slice.call(document.querySelectorAll('._3098d02'));
  groups.slice(4).forEach(function (g) { g.remove(); });
  var keep = [1, 4, 12, 15];
  var cursor = 0;
  groups.slice(0, 4).forEach(function (g, gi) {
    var groupLinks = Array.prototype.slice.call(g.querySelectorAll('a._546d736'));
    groupLinks.forEach(function (a, i) {
      if (i >= keep[gi]) { a.remove(); return; }
      var idx = cursor++;
      a.setAttribute('href', '#');
      a.querySelector('.c08e6e93').textContent = TITLES[idx] || '新对话';
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (state.session === idx) return;
        links.forEach(function (x) { x.classList.remove('b64fb9ae'); });
        a.classList.add('b64fb9ae');
        titleNodes.forEach(function (n) { n.textContent = TITLES[idx]; });
        document.title = TITLES[idx] + ' - DeepSeek';
        render(idx);
        if (isMobile()) setCollapsed(true, false);
      });
      links.push(a);
    });
  });

  var collapseKey = 'disguise-sidebar-collapsed';
  var sidebarOverlay = document.querySelector('._4cbcd96');
  var mobileMenuBtn = document.querySelector('._1aa2651 .ds-button');
  var mobileQuery = window.matchMedia('(max-width: 767px)');
  var expandBtn = document.createElement('div');
  expandBtn.setAttribute('role', 'button');
  expandBtn.setAttribute('aria-label', '展开侧栏');
  expandBtn.className = 'disguise-expand';
  expandBtn.innerHTML = collapseBtn ? collapseBtn.querySelector('svg').outerHTML : '';
  document.body.appendChild(expandBtn);

  function isMobile() { return mobileQuery.matches; }

  // 移动端侧栏是浮层抽屉：展开时才有遮罩，收起时遮罩必须隐藏，否则它常驻整页并吞掉所有点击
  function setCollapsed(collapsed, persist) {
    sider.classList.toggle('a02af2e6', collapsed);
    document.body.classList.toggle('disguise-sider-open', !collapsed && isMobile());
    expandBtn.style.display = collapsed && !isMobile() ? 'flex' : 'none';
    // 移动端是临时抽屉，不写入桌面端的收起偏好
    if (persist && !isMobile()) {
      try { localStorage.setItem(collapseKey, collapsed ? '1' : '0'); } catch (err) { /* 忽略隐私模式限制 */ }
    }
  }

  if (collapseBtn) {
    collapseBtn.style.cursor = 'pointer';
    collapseBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setCollapsed(true, true);
    });
  }
  expandBtn.addEventListener('click', function () { setCollapsed(false, true); });
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', function () { setCollapsed(true, false); });
  }
  if (mobileMenuBtn) {
    mobileMenuBtn.style.cursor = 'pointer';
    mobileMenuBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setCollapsed(false, false);
    });
  }
  if (shareBtn) {
    shareBtn.style.cursor = 'pointer';
    shareBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = BASE + 'review';
    });
  }

  input.addEventListener('input', syncSend);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  });
  sendBtn.addEventListener('click', function (e) { e.preventDefault(); submit(); });
  attachBtn.addEventListener('click', onAttach, true);

  var styleFix = document.createElement('style');
  styleFix.textContent =
    '.ds-scroll-area__gutters{display:none!important}' +
    '.ds-virtual-list{overflow-x:hidden!important}' +
    '.dc04ec1d.a02af2e6{overflow:hidden}' +
    '.dc04ec1d.a02af2e6 > *{display:none!important}' +
    // 收起时给桌面悬浮展开按钮让位；移动端用顶栏汉堡，绝不能套用这条，否则顶栏左侧会空一块
    '@media (min-width:768px){' +
    '.dc04ec1d.a02af2e6 ~ ._7780f2e ._1aa2651{padding-left:44px}' +
    '.dc04ec1d.a02af2e6 ~ ._7780f2e .f8d1e4c0{padding-left:40px}}' +
    '.disguise-expand{position:fixed;left:2px;top:16px;width:26px;height:26px;display:none;align-items:center;justify-content:center;border-radius:6px;color:var(--dsw-alias-label-tertiary);cursor:pointer;z-index:1200}' +
    '.disguise-expand:hover{background:rgba(0,0,0,.05)}' +
    '.ds-virtual-list-visible-items ._0a3d93b .ds-button.is-rated' +
    ',.ds-virtual-list-visible-items ._0a3d93b .ds-button.is-rated>.ds-button__icon{color:#4d6bfe!important}' +
    '.ds-virtual-list-visible-items ._0a3d93b .ds-button.is-rated .ds-button__background{background:rgba(77,107,254,.1)!important}' +
    '.disguise-disclaimer{margin:14px 0 2px;color:var(--dsw-alias-label-tertiary,#8b8b8b);font-size:13px;line-height:1.6;font-style:italic;opacity:.72}' +
    '.ds-virtual-list-visible-items ._11d6b3a .ds-button{opacity:1!important}' +
    '.ds-virtual-list-visible-items ._11d6b3a{margin-top:4px}' +
    '.ds-assistant-message-main-content .pdf-img{margin:16px 0;max-width:100%}' +
    '.ds-assistant-message-main-content .pdf-img img{max-width:100%;height:auto;border-radius:8px}' +
    '.ds-assistant-message-main-content .pdf-img figcaption{color:var(--dsw-alias-label-tertiary,#8b8b8b);font-size:12px;text-align:center;margin-top:6px}' +
    '.ds-assistant-message-main-content .pdf-list{padding-left:22px;list-style:disc}' +
    '.ds-assistant-message-main-content .pdf-list li{margin:6px 0;line-height:1.8}' +
    '.ds-assistant-message-main-content .code-block{margin:16px 0;background:var(--dsw-alias-markdown-code-block,#fafafa);border-radius:12px;overflow:hidden}' +
    '.ds-assistant-message-main-content .code-bar{display:flex;align-items:center;height:34px;padding:0 14px;background:var(--dsw-alias-markdown-code-block-banner,#f3f4f6)}' +
    '.ds-assistant-message-main-content .code-dots{display:none}' +
    '.ds-assistant-message-main-content .code-lang{font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#383a42);text-transform:lowercase;letter-spacing:0}' +
    '.ds-assistant-message-main-content .code-copy{margin-left:auto;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#8b8b8b);font-size:12px;padding:4px 8px;border-radius:6px;cursor:pointer}' +
    '.ds-assistant-message-main-content .code-copy:hover{background:rgba(0,0,0,.05);color:var(--dsw-alias-label-primary,#383a42)}' +
    '.ds-assistant-message-main-content .code-block pre{margin:0;padding:16px;overflow-x:auto;background:transparent;font-family:var(--ds-font-family-code);font-size:13px;line-height:1.6}' +
    // 答案 HTML 里的 <pre class="pyg"><code> 会被 DeepSeek 的 .ds-markdown code{display:inline-flex} 吃掉换行，必须还原成块级 pre
    '.ds-assistant-message-main-content .code-block pre code{display:block;white-space:pre-wrap;word-break:break-all;background:none;padding:0;border-radius:0;font-family:var(--ds-font-family-code);font-size:13px!important;line-height:1.6}' +
    '.ds-assistant-message-main-content .pyg .c,.ds-assistant-message-main-content .pyg .ch,.ds-assistant-message-main-content .pyg .cm,.ds-assistant-message-main-content .pyg .c1,.ds-assistant-message-main-content .pyg .cs,.ds-assistant-message-main-content .pyg .cp,.ds-assistant-message-main-content .pyg .cpf,.ds-assistant-message-main-content .pyg .cn{color:#a0a1a7;font-style:italic}' +
    '.ds-assistant-message-main-content .pyg .k,.ds-assistant-message-main-content .pyg .kc,.ds-assistant-message-main-content .pyg .kd,.ds-assistant-message-main-content .pyg .kn,.ds-assistant-message-main-content .pyg .kp,.ds-assistant-message-main-content .pyg .kr{color:#a626a4}' +
    '.ds-assistant-message-main-content .pyg .kt,.ds-assistant-message-main-content .pyg .nc,.ds-assistant-message-main-content .pyg .nn,.ds-assistant-message-main-content .pyg .ne{color:#b76b01}' +
    '.ds-assistant-message-main-content .pyg .s,.ds-assistant-message-main-content .pyg .s1,.ds-assistant-message-main-content .pyg .s2,.ds-assistant-message-main-content .pyg .sa,.ds-assistant-message-main-content .pyg .sb,.ds-assistant-message-main-content .pyg .sc,.ds-assistant-message-main-content .pyg .dl,.ds-assistant-message-main-content .pyg .sd,.ds-assistant-message-main-content .pyg .sh,.ds-assistant-message-main-content .pyg .si,.ds-assistant-message-main-content .pyg .sx,.ds-assistant-message-main-content .pyg .sr,.ds-assistant-message-main-content .pyg .ss{color:#50a14f}' +
    '.ds-assistant-message-main-content .pyg .se{color:#b76b01}' +
    '.ds-assistant-message-main-content .pyg .m,.ds-assistant-message-main-content .pyg .mb,.ds-assistant-message-main-content .pyg .mf,.ds-assistant-message-main-content .pyg .mh,.ds-assistant-message-main-content .pyg .mi,.ds-assistant-message-main-content .pyg .mo,.ds-assistant-message-main-content .pyg .no{color:#b76b01}' +
    '.ds-assistant-message-main-content .pyg .nf,.ds-assistant-message-main-content .pyg .fm,.ds-assistant-message-main-content .pyg .nb,.ds-assistant-message-main-content .pyg .bp,.ds-assistant-message-main-content .pyg .nd{color:#4078f2}' +
    '.ds-assistant-message-main-content .pyg .nv,.ds-assistant-message-main-content .pyg .vc,.ds-assistant-message-main-content .pyg .vg,.ds-assistant-message-main-content .pyg .vi,.ds-assistant-message-main-content .pyg .nl{color:#4078f2}' +
    '.ds-assistant-message-main-content .pyg .na,.ds-assistant-message-main-content .pyg .nt{color:#b76b01}' +
    '.ds-assistant-message-main-content .pyg .o,.ds-assistant-message-main-content .pyg .ow{color:#4078f2}' +
    '.ds-assistant-message-main-content .pyg .p{color:#383a42}' +
    '.ds-assistant-message-main-content .pyg .gi{color:#50a14f}' +
    '.ds-assistant-message-main-content .pyg .gd{color:#e45649}' +
    '.ds-assistant-message-main-content .pyg .gh,.ds-assistant-message-main-content .pyg .gu,.ds-assistant-message-main-content .pyg .gs{color:#e45649;font-weight:600}' +
    '.ds-assistant-message-main-content .pyg .err{color:#e45649}' +
    '.disguise-tip{position:fixed;z-index:2000;padding:6px 10px;border-radius:8px;background:rgba(28,30,35,.92);color:#fff;font-size:12px;line-height:1.4;white-space:nowrap;pointer-events:none;opacity:0;transform:translate(-50%,-100%);transition:opacity .12s}' +
    '.disguise-tip.show{opacity:1}' +
    // 右侧快速跳转：收起时只露小横线，悬浮展开成 240px 面板（结构取自 DeepSeek 官方样式）
    '.disguise-nav{position:fixed;top:50%;right:16px;transform:translateY(-50%);width:34px;height:300px;display:none;align-items:center;z-index:1000;user-select:none;transition:all .2s}' +
    '.disguise-nav-bg{position:absolute;top:50%;right:0;transform:translateY(-50%);z-index:-1;width:34px;height:calc(100% - 8px);max-height:calc(100% - 8px);border-radius:16px;background:rgba(255,255,255,.8);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}' +
    '.disguise-nav-panel{position:absolute;top:50%;right:0;transform:translateY(-50%);display:flex;flex-direction:column;width:240px;max-height:100%;border:1px solid transparent;border-radius:16px;overflow:hidden;pointer-events:none;transition:background .2s,box-shadow .2s}' +
    '.disguise-nav.is-open .disguise-nav-panel{pointer-events:auto;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:var(--dsw-shadow-lv3,0 4px 16px rgba(0,0,0,.08));border-color:var(--dsw-alias-border-inverted,rgba(0,0,0,.06))}' +
    '.disguise-nav-list{max-height:300px;overflow-y:auto;padding:15px 0 15px 24px;scrollbar-width:none}' +
    '.disguise-nav-list::-webkit-scrollbar{display:none}' +
    '.disguise-nav-item{display:flex;align-items:center;justify-content:flex-end;width:calc(100% - 6px);height:30px;margin-right:8px;line-height:20px;color:var(--dsw-alias-label-tertiary,#8b8b8b);cursor:pointer}' +
    '.disguise-nav-item:hover{color:var(--dsw-alias-label-primary,#1f2329)}' +
    '.disguise-nav-title{margin-right:12px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;transition:opacity .1s,color .2s}' +
    '.disguise-nav.is-open .disguise-nav-title{opacity:1}' +
    '.disguise-nav-item.is-active .disguise-nav-title{color:var(--dsw-alias-brand-text,#4d6bfe);font-weight:500}' +
    '.disguise-nav-dash{display:flex;flex-shrink:0;align-items:center;justify-content:center;width:16px;height:20px}' +
    '.disguise-nav-dash i{display:block;width:8px;height:2px;border-radius:4px;background:var(--dsw-alias-border-l4,#d9d9d9);transition:background-color .2s}' +
    '.disguise-nav-item:hover .disguise-nav-dash i{background:var(--dsw-alias-label-primary,#1f2329)}' +
    '.disguise-nav-item.is-active .disguise-nav-dash i{background:var(--dsw-alias-brand-text,#4d6bfe);transform:scale(1.5)}' +
    '@media not all and (min-width:768px){.disguise-nav{display:none!important}' +
    // 移动端：自带展开按钮在顶栏，隐藏桌面用的悬浮按钮；遮罩只在抽屉展开时出现
    '.disguise-expand{display:none!important}' +
    '._4cbcd96{opacity:0!important;pointer-events:none!important}' +
    'body.disguise-sider-open ._4cbcd96{opacity:1!important;pointer-events:auto!important}' +
    // 顶栏重排：汉堡贴左、标题吃掉剩余宽度、右侧两个按钮统一 44px 且垂直居中
    '._1aa2651{width:auto!important;flex:1 1 auto!important;padding:8px 6px!important}' +
    '._2be88ba{align-items:center!important}' +
    '._9986c0c{flex:1 1 auto;min-width:0;max-width:none!important;margin:0 8px!important}' +
    '._19943ce,._348bebe{display:none!important}' +
    '._1aa2651>.ds-button{width:44px!important;height:44px!important;flex:0 0 44px}' +
    '._57370c5{align-self:center;width:44px!important;height:44px!important;min-width:44px;margin:0 6px 0 2px!important;display:flex;align-items:center;justify-content:center}' +
    '._1aa2651 .ds-button,._57370c5{cursor:pointer}}';
  document.head.appendChild(styleFix);

  var tip = document.createElement('div');
  tip.className = 'disguise-tip';
  document.body.appendChild(tip);

  function showTip(el) {
    var text = el.getAttribute('data-tip');
    if (!text) return;
    tip.textContent = text;
    var rect = el.getBoundingClientRect();
    tip.style.left = Math.round(rect.left + rect.width / 2) + 'px';
    tip.style.top = Math.round(rect.top - 6) + 'px';
    tip.classList.add('show');
  }

  function hideTip() {
    tip.classList.remove('show');
  }

  document.addEventListener('mouseover', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (el) showTip(el);
  });
  document.addEventListener('mouseout', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (el) hideTip();
  });
  document.addEventListener('click', hideTip, true);

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-code-copy]') : null;
    if (!btn) return;
    e.preventDefault();
    var block = btn.closest('.code-block, .md-code-block');
    var pre = block ? block.querySelector('pre') : null;
    if (!pre) return;
    copyText(pre.textContent, function (ok) { flashCopyLabel(btn, ok); });
  });

  function flashCopyLabel(btn, ok) {
    var target = btn.querySelector('.code-info-button-text') || btn;
    if (target.dataset.copying === '1') return;
    target.dataset.copying = '1';
    var original = target.textContent;
    target.textContent = ok ? '已复制' : '复制失败';
    window.setTimeout(function () {
      target.textContent = original;
      delete target.dataset.copying;
    }, 1600);
  }
  window.addEventListener('scroll', hideTip, true);

  items.style.minHeight = '0';
  items.style.paddingTop = '20px';
  items.style.paddingBottom = '40px';
  var fileInput = attachBtn.querySelector('input[type="file"]');
  if (fileInput) fileInput.remove();

  if (links[0]) {
    links[0].classList.add('b64fb9ae');
    titleNodes.forEach(function (n) { n.textContent = TITLES[0]; });
    document.title = TITLES[0] + ' - DeepSeek';
  }
  // 移动端默认收起抽屉；桌面端沿用上次的收起偏好
  function applySidebarDefault() {
    if (isMobile()) {
      setCollapsed(true, false);
      return;
    }
    try {
      setCollapsed(localStorage.getItem(collapseKey) === '1', false);
    } catch (err) { /* 忽略隐私模式限制 */ }
  }
  applySidebarDefault();
  var onViewportChange = function () { applySidebarDefault(); };
  if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', onViewportChange);
  else if (mobileQuery.addListener) mobileQuery.addListener(onViewportChange);
  render(0);
  if (!SELFTEST) loadQueue();

  if (/[?&]selftest=1/.test(location.search)) {
    window.__selfTest = function () {
      var out = [];
      var start = state.qIndex;
      function ok(name, cond) { out.push((cond ? 'PASS ' : 'FAIL ') + name); }
      ok('initial idle', state.phase === 'idle');
      ok('send disabled', sendBtn.classList.contains('ds-button--disabled'));
      ok('demo rendered', visible.children.length === 4);
      attachBtn.click();
      ok('attach fills question', input.value === QS[start].title);
      ok('phase filled', state.phase === 'filled');
      attachBtn.click();
      ok('attach ignored when filled', state.phase === 'filled');
      sendBtn.click();
      ok('answer rendered', state.phase === 'answered');
      ok('input cleared', input.value === '');
      var bars = visible.querySelectorAll('._0a3d93b[data-rated]');
      ok('rate bar present', bars.length === 1);
      var before = state.qIndex;
      visible.querySelector('[data-rate="4"]').click();
      ok('rate bar kept', visible.querySelectorAll('._0a3d93b[data-rated]').length === 1);
      ok('rate selected', visible.querySelectorAll('.is-rated').length === 1);
      ok('rate resets', state.phase === 'idle');
      ok('question advanced', state.qIndex === (before + 1) % QS.length);
      visible.querySelector('[data-rate="2"]').click();
      ok('reselect keeps one', visible.querySelectorAll('.is-rated').length === 1);
      ok('reselect no advance', state.qIndex === (before + 1) % QS.length);
      attachBtn.click();
      ok('attach next question', input.value === QS[(start + 1) % QS.length].title);
      return out.join('\n');
    };
  }
})();
