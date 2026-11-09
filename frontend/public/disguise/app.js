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

  function apiGet(url) {
    return fetch(apiUrl(url), { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  function apiPost(url, body) {
    return fetch(apiUrl(url), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
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

  function codeBlock(text, lang) {
    if (!codeTpl) return '<pre><code>' + esc(text) + '</code></pre>';
    var node = codeTpl.cloneNode(true);
    var pre = node.querySelector('pre');
    if (pre) pre.innerHTML = text.split('\n').map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('\n');
    var label = node.querySelector('.d813de27');
    if (label) label.textContent = lang || 'text';
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
          if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
        });
      }
      if (buttons[1]) buttons[1].style.cursor = 'pointer';
    }
    return node;
  }

  function aiNode(html, rate) {
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
    var disclaimer = document.createElement('p');
    disclaimer.className = 'disguise-disclaimer';
    disclaimer.textContent = '本回答由 AI 生成，内容仅供参考，请仔细甄别';
    content.appendChild(disclaimer);
    if (!bar) return node;
    bar.style.display = 'flex';
    var group = bar.querySelector('._965abe9');
    if (group) group.style.opacity = '1';
    if (!rate) {
      tagTips(bar, ['复制', '重新生成', '点赞', '点踩', '朗读', '分享']);
      return node;
    }
    bar.setAttribute('data-rated', '0');
    var buttons = bar.querySelectorAll('.ds-button');
    Array.prototype.slice.call(buttons, 4).forEach(function (b) { b.remove(); });
    var rateTips = ['重来', '困难', '良好', '容易'];
    [].slice.call(buttons, 0, 4).forEach(function (b, i) {
      b.setAttribute('data-rate', String(i + 1));
      b.setAttribute('data-tip', rateTips[i] + '（' + (i + 1) + '）');
      b.setAttribute('aria-label', rateTips[i]);
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        selectRate(node, i);
      });
    });
    return node;
  }

  function selectRate(node, index) {
    var bar = node.querySelector('._0a3d93b');
    if (!bar) return;
    var buttons = bar.querySelectorAll('.ds-button');
    Array.prototype.forEach.call(buttons, function (b, i) {
      b.classList.toggle('is-rated', i === index);
    });
    if (bar.getAttribute('data-rated') === '1') return;
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
    apiPost('/api/review/answer', {
      cardId: card.cardId,
      rating: index + 1,
      clientId: review.clientId
    }).then(function (data) {
      review.card = data.next || null;
      state.phase = 'idle';
      syncSend();
      if (!review.card) notifyEmpty();
    }).catch(function () {
      bar.setAttribute('data-rated', '0');
      Array.prototype.forEach.call(bar.querySelectorAll('.ds-button'), function (b) {
        b.classList.remove('is-rated');
      });
      notice('抱歉，这次评分没有提交成功，请再点一次。');
    });
  }

  function append(node) {
    visible.appendChild(node);
    requestAnimationFrame(function () {
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
        scroller.scrollLeft = 0;
      }
    });
  }

  function render(session) {
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
    var canSend = hasText && (state.session !== 0 || state.phase === 'filled');
    if (canSend) sendBtn.classList.remove('ds-button--disabled');
    else sendBtn.classList.add('ds-button--disabled');
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
        append(aiNode(q.html, true));
      } else {
        apiGet('/api/review/card-answer?qid=' + encodeURIComponent(card.qid)).then(function (data) {
          append(aiNode(data.answerHtml, true));
          syncSend();
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
      });
      links.push(a);
    });
  });

  var collapseKey = 'disguise-sidebar-collapsed';
  var expandBtn = document.createElement('div');
  expandBtn.setAttribute('role', 'button');
  expandBtn.setAttribute('aria-label', '展开侧栏');
  expandBtn.className = 'disguise-expand';
  expandBtn.innerHTML = collapseBtn ? collapseBtn.querySelector('svg').outerHTML : '';
  document.body.appendChild(expandBtn);

  function setCollapsed(collapsed, persist) {
    sider.classList.toggle('a02af2e6', collapsed);
    expandBtn.style.display = collapsed ? 'flex' : 'none';
    if (persist) {
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
    '.dc04ec1d.a02af2e6 ~ ._7780f2e ._1aa2651{padding-left:44px}' +
    '.dc04ec1d.a02af2e6 ~ ._7780f2e .f8d1e4c0{padding-left:40px}' +
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
    '.ds-assistant-message-main-content .code-block{margin:14px 0}' +
    '.ds-assistant-message-main-content .code-block pre{overflow:auto}' +
    '.disguise-tip{position:fixed;z-index:2000;padding:6px 10px;border-radius:8px;background:rgba(28,30,35,.92);color:#fff;font-size:12px;line-height:1.4;white-space:nowrap;pointer-events:none;opacity:0;transform:translate(-50%,-100%);transition:opacity .12s}' +
    '.disguise-tip.show{opacity:1}';
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
  try {
    if (localStorage.getItem(collapseKey) === '1') setCollapsed(true, false);
  } catch (err) { /* 忽略隐私模式限制 */ }
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
