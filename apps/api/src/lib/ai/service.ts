/**
 * 🧠 NEXUS SALES AI - SERVIÇO UNIFICADO
 *
 * Classe principal que gerencia chamadas aos 3 providers:
 * - OpenAI (gpt-4o)
 * - Gemini (gemini-2.0-flash-exp)
 * - Groq (llama-3.3-70b-versatile)
 *
 * Features:
 * - Seleção automática de provider por tarefa
 * - Fallback automático se um provider falhar
 * - Streaming para respostas em tempo real
 * - Retry logic e tratamento de erros
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_PROVIDERS, AIProvider, selectProvider } from './providers';

export interface GenerateOptions {
  prompt: string;
  systemPrompt: string;
  task: string;
  provider?: AIProvider;
  jsonMode?: boolean;
}

export interface StreamOptions {
  prompt: string;
  systemPrompt: string;
  provider?: AIProvider;
}

export class NexusSalesAI {
  private openai: OpenAI;
  private gemini: GoogleGenerativeAI;
  private groq: OpenAI;

  constructor() {
    // Inicializar OpenAI
    this.openai = new OpenAI({
      apiKey: AI_PROVIDERS.openai.apiKey,
    });

    // Inicializar Gemini
    this.gemini = new GoogleGenerativeAI(AI_PROVIDERS.gemini.apiKey);

    // Inicializar Groq (usa interface compatível com OpenAI)
    this.groq = new OpenAI({
      apiKey: AI_PROVIDERS.groq.apiKey,
      baseURL: AI_PROVIDERS.groq.baseUrl,
    });

    console.log('✅ [NexusSalesAI] Providers inicializados com sucesso');
  }

  // ========================================
  // MÉTODO PRINCIPAL: GERAR RESPOSTA
  // ========================================
  async generate(options: GenerateOptions): Promise<string> {
    const provider = options.provider || selectProvider(options.task);

    console.log(
      `[NexusSalesAI] Task: ${options.task} → Provider: ${provider.toUpperCase()}`,
    );

    try {
      switch (provider) {
        case 'openai':
          return await this.callOpenAI(
            options.prompt,
            options.systemPrompt,
            options.jsonMode,
          );
        case 'gemini':
          return await this.callGemini(
            options.prompt,
            options.systemPrompt,
            options.jsonMode,
          );
        case 'groq':
          return await this.callGroq(
            options.prompt,
            options.systemPrompt,
            options.jsonMode,
          );
        default:
          return await this.callGroq(
            options.prompt,
            options.systemPrompt,
            options.jsonMode,
          );
      }
    } catch (error) {
      console.error(`❌ [NexusSalesAI] Error with ${provider}:`, error);
      // Fallback: tentar outro provider
      return await this.fallback(options, provider);
    }
  }

  // ========================================
  // STREAMING PARA CHAT EM TEMPO REAL
  // ========================================
  async *generateStream(options: StreamOptions): AsyncGenerator<string> {
    const provider = options.provider || 'groq';
    const client = provider === 'groq' ? this.groq : this.openai;
    const config = AI_PROVIDERS[provider];

    console.log(`[NexusSalesAI] Streaming with ${provider.toUpperCase()}`);

    try {
      const stream = await client.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.prompt },
        ],
        stream: true,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
      }
    } catch (error) {
      console.error(`❌ [NexusSalesAI] Streaming error:`, error);
      yield 'Desculpe, ocorreu um erro ao processar sua mensagem.';
    }
  }

  // ========================================
  // PROVIDERS INDIVIDUAIS
  // ========================================

  private async callOpenAI(
    prompt: string,
    systemPrompt: string,
    jsonMode?: boolean,
  ): Promise<string> {
    const config = AI_PROVIDERS.openai;

    const response = await this.openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
    });

    return response.choices[0].message.content || '';
  }

  private async callGemini(
    prompt: string,
    systemPrompt: string,
    jsonMode?: boolean,
  ): Promise<string> {
    const config = AI_PROVIDERS.gemini;

    const model = this.gemini.getGenerativeModel({
      model: config.model,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
        responseMimeType: jsonMode ? 'application/json' : 'text/plain',
      },
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  private async callGroq(
    prompt: string,
    systemPrompt: string,
    jsonMode?: boolean,
  ): Promise<string> {
    const config = AI_PROVIDERS.groq;

    const response = await this.groq.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
    });

    return response.choices[0].message.content || '';
  }

  // ========================================
  // FALLBACK AUTOMÁTICO
  // ========================================
  private async fallback(
    options: GenerateOptions,
    failedProvider: AIProvider,
  ): Promise<string> {
    const fallbackOrder: AIProvider[] = ['groq', 'gemini', 'openai'];
    const remaining = fallbackOrder.filter((p) => p !== failedProvider);

    console.log(
      `[NexusSalesAI] 🔄 Tentando fallback: ${remaining.join(' → ')}`,
    );

    for (const provider of remaining) {
      try {
        console.log(`[NexusSalesAI] Fallback para: ${provider.toUpperCase()}`);
        return await this.generate({ ...options, provider });
      } catch (error) {
        console.error(`❌ [NexusSalesAI] Fallback ${provider} falhou:`, error);
        continue;
      }
    }

    throw new Error('Todos os providers falharam. Tente novamente mais tarde.');
  }
}

// ========================================
// SINGLETON - INSTÂNCIA ÚNICA
// ========================================
export const salesAI = new NexusSalesAI();
