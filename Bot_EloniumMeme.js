import { createRequire } from 'module'
import axios from 'axios'
const require = createRequire(import.meta.url)
const TelegramBot = require('node-telegram-bot-api')
const Jimp = require('jimp');
const dotenv = require('dotenv')

const userMessageTime = new Map()

dotenv.config()
const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: true })
let lastMessageTime = 0
async function createPrediction (text) {
  let promptText = text.replace("elon musk", "");
  promptText = promptText.replace("Elon musk", "");
  promptText = promptText.replace("Elon Musk", "");
  promptText = promptText.replace("ELON MUSK", "");
  promptText = promptText.replace("Elon", "");
  promptText = promptText.replace("elon", "");

  console.log(promptText);

  const response = await axios.post(
    'https://api.replicate.com/v1/predictions',
    {
      // Pinned to a specific version of Stable Diffusion
      // See https://replicate.com/stability-ai/stable-diffussion/versions
      version:
        '9936c2001faa2194a261c01381f90e65261879985476014a0a37a334593a05eb', //stable-diffussion
      input: { prompt: 'Elon Musk, Elon Musk ' + promptText + ', Elon Musk himself, funny meme, close up, concept art, intricate details, highly detailed'}
    },
    {
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  )

  const prediction = response.data
  return prediction
}

async function getPredictionStatus (id) {
  const response = await axios.get(
    'https://api.replicate.com/v1/predictions/' + id,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`
      }
    }
  )

  const prediction = response.data
  console.log(response)
  return prediction
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const pending = async (sentMessage, chatId, username) => {
  let index = 59
  while (index > 0) {
    index--
    await sleep(1000)
    bot.editMessageText(
      '@' +
        username +
        " You're in cooldown mode please wait " +
        index +
        ' seconds.',
      {
        chat_id: chatId,
        message_id: sentMessage.message_id
      }
    )
  }
}
bot.onText(/\/elonium (.+)/, async (msg, match) => {
  const chatId = msg.chat.id
  const username = msg.from.username
  const now = Date.now()

  if (userMessageTime.has(chatId)) {
    lastMessageTime = userMessageTime.get(chatId)
    const timeDifference = now - lastMessageTime
    lastMessageTime = now

    if (timeDifference < 15 * 1000) {
      bot
        .sendMessage(
          chatId,
          '@' +
            username +
            " You're in cooldown mode please wait 14 seconds."
        )
        .then(sentMessage => {
          pending(sentMessage, chatId, username)
        })
      return
    }
  }
  // Update the last message time for this user
  userMessageTime.set(chatId, now)
  bot.sendMessage(
    chatId, "Generating Image for @" + username
  )
  //"Generating Image for @" + username
  //"I hope to discuss in telegram with you. My telegram id is GloryDream413."
  // const image = await generateImage(match[1]);
  const prediction = await createPrediction(match[1])
  let response = null
  let nCount = 0;
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
    await sleep(1000);
    nCount++;
    if(nCount >= 60)
    {
      break;
    }
    response = await getPredictionStatus(prediction.id)
    if (response.err || response.output) {
      break
    }
  }
  if (response.output) {
    const imageUrl = response.output[0];
    const photo = await Jimp.read(imageUrl);
    // Download the image
    const watermark = await Jimp.read('./logo.png');
    const x = photo.bitmap.width - watermark.bitmap.width - 10;
    const y = photo.bitmap.height - watermark.bitmap.height - 10;
    // Add the watermark to the photo
    photo.composite(watermark, x, y);
    const photoBuffer = await photo.getBufferAsync(Jimp.MIME_JPEG);
    bot.sendPhoto(chatId, photoBuffer, {
      caption: 'Generated for @' + username + ': ' + match[1],
      reply_to_message_id: msg.message_id
    })
    console.log('Generated for @' + username)
  } else {
    bot.sendMessage(chatId, 'Sorry. could you again please.');
  }
})
if(bot.isPolling()) {
  await bot.stopPolling();
}
await bot.startPolling();