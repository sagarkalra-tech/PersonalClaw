import { Telegraf } from 'telegraf';
// FIX-3: telegramBrain imported from neutral file, not declared here
import { telegramBrain } from '../core/telegram-brain.js';

// ─── Markdown → Telegram-friendly text ─────────────────────────────
// Gemini returns GitHub-flavored markdown which looks like garbage in
// Telegram's default (non-parsed) mode.  We convert to Telegram's
// MarkdownV2 where possible, falling back to clean plaintext.

function markdownToTelegram(text: string): { text: string; parse_mode?: 'MarkdownV2' } {
  try {
    let out = text;

    // Remove ### / ## / # headers → bold text
    out = out.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

    // Bold:  **text** or __text__ → *text*
    out = out.replace(/\*\*(.+?)\*\*/g, '*$1*');
    out = out.replace(/__(.+?)__/g, '*$1*');

    // Italic: *text* (single) → _text_  (but avoid already-converted bold)
    // Only convert single asterisks that aren't part of double-star bold
    out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');

    // Strikethrough: ~~text~~ → ~text~
    out = out.replace(/~~(.+?)~~/g, '~$1~');

    // Inline code: `text` → `text` (same in MarkdownV2)
    // Code blocks: ```lang\n...\n``` → ```\n...\n```
    out = out.replace(/```\w*\n([\s\S]*?)```/g, '```\n$1```');

    // Bullet lists: - item or * item → • item
    out = out.replace(/^[\-\*]\s+/gm, '• ');

    // Numbered lists are fine as-is

    // Escape MarkdownV2 special chars OUTSIDE of already-formatted regions
    // We need to escape: . ! ( ) { } | > + = -
    // But NOT inside ` ` or * * or _ _ or ~ ~
    // Simple approach: escape only the dangerous ones that cause parse failures
    out = out.replace(/(?<!\\)([.!(){}|>+=\-])/g, '\\$1');

    // Un-escape inside code blocks (they don't need escaping)
    out = out.replace(/```\n([\s\S]*?)```/g, (match, code) => {
      return '```\n' + code.replace(/\\([.!(){}|>+=\-])/g, '$1') + '```';
    });

    // Un-escape inside inline code
    out = out.replace(/`([^`]+)`/g, (match, code) => {
      return '`' + code.replace(/\\([.!(){}|>+=\-])/g, '$1') + '`';
    });

    return { text: out, parse_mode: 'MarkdownV2' };
  } catch {
    // If anything goes wrong, fall back to cleaned plaintext
    return { text: markdownToPlaintext(text) };
  }
}

function markdownToPlaintext(text: string): string {
  let out = text;
  // Remove header markers
  out = out.replace(/^#{1,6}\s+/gm, '');
  // Remove bold/italic markers
  out = out.replace(/\*\*(.+?)\*\*/g, '$1');
  out = out.replace(/__(.+?)__/g, '$1');
  out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1');
  out = out.replace(/_(.+?)_/g, '$1');
  // Remove strikethrough
  out = out.replace(/~~(.+?)~~/g, '$1');
  // Clean code blocks
  out = out.replace(/```\w*\n([\s\S]*?)```/g, '$1');
  // Bullet lists
  out = out.replace(/^[\-\*]\s+/gm, '• ');
  return out;
}

// ─── Telegram Interface ─────────────────────────────────────────────

export class TelegramInterface {
  private bot: Telegraf | null = null;
  private launchRetries = 0;
  private maxRetries = 5;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      this.bot = new Telegraf(token);
      this.setupHandlers();
      this.launchWithRetry();
      console.log('[Telegram] Bot initialization triggered');
    } else {
      console.warn('[Telegram] TELEGRAM_BOT_TOKEN not found. Telegram interface disabled.');
    }
  }

  private async launchWithRetry(): Promise<void> {
    if (!this.bot) return;

    while (this.launchRetries < this.maxRetries) {
      try {
        // Drop pending updates to avoid stale message buildup
        await this.bot.launch({ dropPendingUpdates: true });
        console.log('[Telegram] Bot polling started successfully.');
        this.launchRetries = 0;
        return;
      } catch (err: any) {
        this.launchRetries++;
        const is409 = err?.message?.includes('409');
        const delay = is409
          ? Math.min(5000 * this.launchRetries, 30000) // back off for 409 conflicts
          : 3000;
        console.error(`[Telegram] Launch attempt ${this.launchRetries}/${this.maxRetries} failed:`, err?.message || err);
        if (this.launchRetries < this.maxRetries) {
          console.log(`[Telegram] Retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    console.error('[Telegram] Bot failed to start after max retries. Incoming messages will not work.');
  }

  /** Send a formatted reply, splitting long messages and falling back to plaintext on error. */
  private async sendFormattedReply(
    ctx: { reply: (text: string, extra?: any) => Promise<any> },
    response: string,
  ): Promise<void> {
    const { text, parse_mode } = markdownToTelegram(response);
    const chunks: string[] = [];
    // Telegram 4096 char limit — split if needed
    for (let i = 0; i < text.length; i += 4096) {
      chunks.push(text.substring(i, i + 4096));
    }
    for (const chunk of chunks) {
      try {
        await ctx.reply(chunk, parse_mode ? { parse_mode } : undefined);
      } catch {
        // MarkdownV2 parse failed — retry as clean plaintext
        const plain = markdownToPlaintext(chunk);
        await ctx.reply(plain);
      }
    }
  }

  private setupHandlers() {
    if (!this.bot) return;

    // Catch polling/runtime errors so the bot doesn't crash silently
    this.bot.catch((err: any, ctx) => {
      console.error('[Telegram] Bot error:', err?.message || err);
    });

    this.bot.start((ctx) => ctx.reply('Welcome to PersonalClaw. I am your Windows agent. Send me a command!'));

    this.bot.on('text', async (ctx) => {
      const message = ctx.message.text;
      const chatId = ctx.from?.id;
      const authorizedId = process.env.AUTHORIZED_CHAT_ID;

      if (authorizedId && chatId?.toString() !== authorizedId) {
        console.warn(`[Telegram] Unauthorized access attempt from ${chatId}`);
        await ctx.reply('Unauthorized. This bot is locked to its owner.');
        return;
      }

      console.log(`[Telegram] Received message from ${chatId}:`, message);

      // Keep "typing..." indicator alive every 4s while processing
      const typingInterval = setInterval(() => {
        ctx.sendChatAction('typing').catch(() => {});
      }, 4000);
      // Fire the first one immediately
      ctx.sendChatAction('typing').catch(() => {});

      try {
        const response = await telegramBrain.processMessage(message);
        clearInterval(typingInterval);
        await this.sendFormattedReply(ctx, response);
      } catch (error: any) {
        clearInterval(typingInterval);
        console.error('[Telegram] Error processing message:', error);
        await ctx.reply(`Error: ${error.message}`);
      }
    });

    // Handle photos for vision tasks
    this.bot.on('photo', async (ctx) => {
      const chatId = ctx.from?.id;
      const authorizedId = process.env.AUTHORIZED_CHAT_ID;

      if (authorizedId && chatId?.toString() !== authorizedId) {
        return;
      }

      await ctx.reply('Vision capabilities are being integrated. I can see the photo but I need a moment to process it in context.');
    });
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.bot) return;
    const authorizedId = process.env.AUTHORIZED_CHAT_ID;
    if (!authorizedId) {
      console.warn('[Telegram] Cannot send proactive message: AUTHORIZED_CHAT_ID not set.');
      return;
    }
    try {
      const { text, parse_mode } = markdownToTelegram(message);
      await this.bot.telegram.sendMessage(
        authorizedId,
        text,
        parse_mode ? { parse_mode } : undefined,
      );
    } catch {
      // Fallback: send as plaintext if MarkdownV2 parsing fails
      try {
        const plain = markdownToPlaintext(message);
        await this.bot.telegram.sendMessage(authorizedId, plain);
      } catch (err) {
        console.error('[Telegram] Failed to send message:', err);
      }
    }
  }

  stop() {
    if (this.bot) {
      console.log('[Telegram] Stopping bot polling...');
      this.bot.stop('SIGINT');
    }
  }
}
