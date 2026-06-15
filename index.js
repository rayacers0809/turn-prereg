/**
 *  Turn City 사전예약 봇 (Railway 배포용)
 */

require('dotenv').config();
const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder,
  ButtonStyle, PermissionFlagsBits,
} = require('discord.js');
const admin = require('firebase-admin');

// ── Firebase 초기화 (Railway 환경변수 or 로컬 파일) ────
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require(process.env.FIREBASE_KEY || './firebase-key.json');
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ preferRest: true, ignoreUndefinedProperties: true });

const COL_REG = 'prereg';
const META    = 'prereg_meta';
const BTN_ID  = 'prereg_register';

// ── Firestore 로직 ──────────────────────────────────────
async function nextCode() {
  const ref = db.collection(META).doc('counter');
  const seq = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const cur = snap.exists ? (snap.data().seq || 0) : 0;
    const nxt = cur + 1;
    t.set(ref, { seq: nxt }, { merge: true });
    return nxt;
  });
  return { code: 'TURN-' + String(seq).padStart(5, '0'), number: seq };
}

async function getTotal() {
  const snap = await db.collection(META).doc('counter').get();
  return snap.exists ? (snap.data().seq || 0) : 0;
}

async function doRegister(discordId, discordTag, charName) {
  const ref = db.collection(COL_REG).doc(String(discordId));
  const snap = await ref.get();
  if (snap.exists) return { created: false, ...snap.data() };
  const { code, number } = await nextCode();
  const data = {
    discordId: String(discordId), discordTag: discordTag || '', charName: charName || '',
    code, number, source: 'bot', claimed: false, claimedBy: null, claimedAt: null,
    createdAt: Date.now(),
  };
  await ref.set(data);
  return { created: true, ...data };
}

async function lookup(discordId) {
  const snap = await db.collection(COL_REG).doc(String(discordId)).get();
  return snap.exists ? snap.data() : null;
}

// ── 패널 ────────────────────────────────────────────────
function buildPanel(total) {
  const embed = new EmbedBuilder()
    .setColor(0x22d3ee)
    .setTitle('🏙️ Turn City 사전예약')
    .setDescription([
      '• 아래 **사전예약** 버튼을 눌러 신청하세요.',
      '• 보상은 추후 공개됩니다.',
      '• Turn City 를 기다려주시는 모든 분들께 감사드립니다.',
      '',
      `> 🎮 현재 **${total.toLocaleString()}명**과 함께하고 있습니다!`,
    ].join('\n'))
    .setFooter({ text: '오픈일에 서버 접속 시 보상이 자동 지급됩니다.' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(BTN_ID).setLabel('사전예약').setStyle(ButtonStyle.Primary).setEmoji('📝'),
  );
  return { embeds: [embed], components: [row] };
}

function userTag(user) {
  return user.discriminator && user.discriminator !== '0'
    ? `${user.username}#${user.discriminator}` : user.username;
}

async function assignRole(interaction) {
  const roleId = process.env.PREREG_ROLE_ID;
  if (!roleId || !interaction.inGuild()) return;
  try {
    if (!interaction.member.roles.cache.has(roleId)) await interaction.member.roles.add(roleId);
  } catch (_) {}
}

// ── 슬래시 명령어 ────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('사전예약패널')
    .setDescription('이 채널에 사전예약 패널을 게시합니다. (관리자)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('사전예약조회')
    .setDescription('내 사전예약 번호와 상태를 확인합니다.'),
];

// ── 클라이언트 ──────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const body = commands.map(c => c.toJSON());
  try {
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body });
      console.log('✅ 길드 명령어 등록 완료');
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body });
      console.log('✅ 글로벌 명령어 등록 완료');
    }
  } catch (e) { console.error('명령어 등록 실패', e); }
  console.log(`🤖 ${client.user.tag} 로그인 완료`);
});

client.on('interactionCreate', async (interaction) => {
  // 버튼 = 사전예약 신청
  if (interaction.isButton() && interaction.customId === BTN_ID) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const r = await doRegister(interaction.user.id, userTag(interaction.user), '');
      await assignRole(interaction);
      if (r.created) {
        await interaction.editReply(`✅ **사전예약이 완료되었습니다!** 좋은 하루 보내세요 🎉\n예약번호: \`${r.code}\` (오픈일 접속 시 자동 지급)`);
        try { await interaction.message.edit(buildPanel(await getTotal())); } catch (_) {}
      } else {
        await interaction.editReply(`ℹ️ 이미 사전예약하셨어요.\n예약번호: \`${r.code}\``);
      }
    } catch (e) {
      console.error(e);
      await interaction.editReply('❌ 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === '사전예약패널') {
    await interaction.reply({ content: '패널을 게시했어요.', ephemeral: true });
    await interaction.channel.send(buildPanel(await getTotal()));
    return;
  }

  if (interaction.commandName === '사전예약조회') {
    await interaction.deferReply({ ephemeral: true });
    const reg = await lookup(interaction.user.id);
    if (!reg) {
      await interaction.editReply('아직 사전예약 내역이 없어요. 패널의 **사전예약** 버튼을 눌러주세요!');
      return;
    }
    await interaction.editReply([
      '```',
      '┌─ TURN CITY 사전예약 ──────────────┐',
      `│ 번호 : ${reg.code}`,
      `│ 상태 : ${reg.claimed ? '보상 수령 완료' : '오픈일 대기중'}`,
      '└───────────────────────────────────┘',
      '```',
      '오픈일에 서버 접속만 하면 보상이 자동 지급됩니다.',
    ].join('\n'));
    return;
  }
});

client.login(process.env.DISCORD_TOKEN);