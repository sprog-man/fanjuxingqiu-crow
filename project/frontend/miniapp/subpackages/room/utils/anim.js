const HUMOR_LINES = [
  '恭喜成为本局幸运鹅 🦆',
  '今晚这顿安排上了 🍷',
  '这顿饭你请，大家记住你了 😎',
  '运气也是实力的一部分 👏',
  '恭喜中奖！下次继续努力 💪',
  '恭喜成为今晚的「财务大臣」💰',
  '这一顿，值得！🍽️',
];

function randomHumor() {
  return HUMOR_LINES[Math.floor(Math.random() * HUMOR_LINES.length)];
}

module.exports = { randomHumor };
