import {modelDetails, OpenAIModel} from "../models/model";
import {ChatCompletion, ChatCompletionMessage, ChatCompletionRequest, ChatMessage, ChatMessagePart, Role} from "../models/ChatCompletion";
import {OPENAI_API_KEY} from "../config";
import {CustomError} from "./CustomError";

import { MessageType } from "../models/ChatCompletion";

const API_BASE_URL = "http://localhost:8000";  // Change to your FastAPI server
const CHAT_COMPLETIONS_ENDPOINT = `${API_BASE_URL}/v1/chat/completions`;
const MODELS_ENDPOINT = `${API_BASE_URL}/v1/models`;  // If a model list API exists


import {ChatSettings} from "../models/ChatSettings";
import {CHAT_STREAM_DEBOUNCE_TIME, DEFAULT_MODEL} from "../constants/appConstants";
import {NotificationService} from '../service/NotificationService';
import { FileData, FileDataRef } from "../models/FileData";

interface CompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: CompletionChunkChoice[];
}

interface CompletionChunkChoice {
  index: number;
  delta: {
    content: string;
  };
  finish_reason: null | string; // If there can be other values than 'null', use appropriate type instead of string.
}

export class ChatService {
  private static models: Promise<OpenAIModel[]> | null = null;
  static abortController: AbortController | null = null;


  static async mapChatMessagesToCompletionMessages(modelId: string, messages: ChatMessage[]): Promise<ChatCompletionMessage[]> {
    const model = await this.getModelById(modelId); // Retrieve the model details
    if (!model) {
      throw new Error(`Model with ID '${modelId}' not found`);
    }

    return messages.map((message) => {
      const contentParts: ChatMessagePart[] = [{
        type: 'text',
        text: message.content
      }];

      if (model.image_support && message.fileDataRef) {
        message.fileDataRef.forEach((fileRef) => {
          const fileUrl = fileRef.fileData!.data;
          if (fileUrl) {
            const fileType = (fileRef.fileData!.type.startsWith('image')) ? 'image_url' : fileRef.fileData!.type;
            contentParts.push({
              type: fileType,
              image_url: {
                url: fileUrl
              }
            });
          }
        });
      }
      return {
        role: message.role,
        content: contentParts,
      };
    });
  }


  static async sendMessage(messages: ChatMessage[], modelId: string): Promise<ChatMessage> {
      try {
          console.log("🛠 Sending chat request to backend...");
          console.log("Model:", modelId);
          console.log("Messages:", messages);

          const response = await fetch(CHAT_COMPLETIONS_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  model: modelId,
                  messages: messages.map(msg => ({
                      role: msg.role,
                      content: msg.content,
                  })),
                  stream: false,
              }),
          });

          if (!response.ok) {
              throw new Error(`❌ Chat API failed: ${response.statusText}`);
          }

          const data = await response.json();
          console.log("✅ API Response Data:", data);

          if (!data.choices || data.choices.length === 0) {
              throw new Error("❌ No response received from AI model.");
          }

          const newMessage: ChatMessage = {
              id: data.id,
              role: Role.Assistant,
              content: data.choices[0].message.content,
              messageType: MessageType.Normal,
          };

          console.log("📩 Adding message to chat state:", newMessage);
          return newMessage;
      } catch (error) {
          console.error("❌ Error in ChatService.sendMessage:", error);
          throw error;
      }
  }



  private static lastCallbackTime: number = 0;
  private static callDeferred: number | null = null;
  private static accumulatedContent: string = ""; // To accumulate content between debounced calls

  static debounceCallback(callback: (content: string, fileDataRef: FileDataRef[]) => void, delay: number = CHAT_STREAM_DEBOUNCE_TIME) {
    return (content: string) => {
      this.accumulatedContent += content; // Accumulate content on each call
      const now = Date.now();
      const timeSinceLastCall = now - this.lastCallbackTime;

      if (this.callDeferred !== null) {
        clearTimeout(this.callDeferred);
      }

      this.callDeferred = window.setTimeout(() => {
        callback(this.accumulatedContent,[]); // Pass the accumulated content to the original callback
        this.lastCallbackTime = Date.now();
        this.accumulatedContent = ""; // Reset the accumulated content after the callback is called
      }, delay - timeSinceLastCall < 0 ? 0 : delay - timeSinceLastCall);  // Ensure non-negative delay

      this.lastCallbackTime = timeSinceLastCall < delay ? this.lastCallbackTime : now; // Update last callback time if not within delay
    };
  }


  static async sendMessageStreamed(
    chatSettings: ChatSettings,
    messages: ChatMessage[],
    callback: (content: string, fileDataRef: FileDataRef[]) => void
  ): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch(CHAT_COMPLETIONS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: chatSettings.model ?? "default-model",
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          stream: true,  // Ensure FastAPI handles streaming
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) throw new Error(`Failed to start streaming: ${response.statusText}`);
      if (!response.body) throw new Error("Streaming response body is null.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        callback(chunk, []);  // Pass the chunk to UI for real-time display
      }

    } catch (error) {
      if (error instanceof Error) {
        NotificationService.handleUnexpectedError(error, "Streaming error");
      } else {
        console.error("Unknown streaming error:", error);
      }
    }

  } // ✅ This closing bracket properly ends sendMessageStreamed()

  // Define cancelStream() outside sendMessageStreamed()
  static cancelStream = (): void => {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  };


  static async getModels(): Promise<OpenAIModel[]> {
      try {
          const response = await fetch(MODELS_ENDPOINT);
          const data = await response.json();

          return data.data.map((modelName: string) => ({
              id: modelName,  // ✅ Ensure `id` is a string
              name: modelName, // ✅ Ensure `name` is a string
              object: "model",
              owned_by: "ollama",
              permission: [],
              context_window: 4096,
              knowledge_cutoff: "unknown",
              image_support: false,
              preferred: false,
              deprecated: false
          })) as OpenAIModel[];
      } catch (error: any) {
          console.error("Failed to fetch models:", error.message || error);
          return [];
      }
  }

  static async getModelById(modelId: string): Promise<OpenAIModel | null> {
      try {
          const models = await ChatService.getModels();

          const foundModel = models.find(model => model.id === modelId);

          if (!foundModel) {
              console.warn(`⚠️ Model '${modelId}' not found. Available models:`, models.map(m => m.id));
              return null;  // ✅ Avoid crashing if the model isn't found
          }

          return foundModel;
      } catch (error: any) {
          console.error("Failed to fetch models:", error.message || error);
          throw new CustomError("Error retrieving models.", {
              code: "FETCH_MODELS_FAILED",
              status: (error as any).status || 500
          });
      }
  }


  static fetchModels = (): Promise<OpenAIModel[]> => {
    if (this.models !== null) {
      return Promise.resolve(this.models);
    }
    this.models = fetch(MODELS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
    })
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => {
              throw new Error(err.error.message);
            });
          }
          return response.json();
        })
        .catch(err => {
          throw new Error(err.message || err);
        })
        .then(data => {
          const models: OpenAIModel[] = data.data;
          // Filter, enrich with contextWindow from the imported constant, and sort
          return models
              .filter(model => model.id.startsWith("gpt-"))
              .map(model => {
                const details = modelDetails[model.id] || {
                  contextWindowSize: 0,
                  knowledgeCutoffDate: '',
                  imageSupport: false,
                  preferred: false,
                  deprecated: false,
                };
                return {
                  ...model,
                  context_window: details.contextWindowSize,
                  knowledge_cutoff: details.knowledgeCutoffDate,
                  image_support: details.imageSupport,
                  preferred: details.preferred,
                  deprecated: details.deprecated,
                };
              })
              .sort((a, b) => b.id.localeCompare(a.id));
        });
    return this.models;
  };
}

