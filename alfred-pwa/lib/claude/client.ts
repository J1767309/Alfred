import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  systemPrompt: string;
  messages: Message[];
  maxTokens?: number;
}

export async function chat(options: ChatOptions): Promise<string> {
  const { systemPrompt, messages, maxTokens = 4096 } = options;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textContent = response.content.find(c => c.type === 'text');
  return textContent?.text || '';
}

export async function generateSummary(
  systemPrompt: string,
  content: string,
  maxTokens: number = 8192
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  });

  const textContent = response.content.find(c => c.type === 'text');
  return textContent?.text || '';
}
