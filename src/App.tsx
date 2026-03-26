/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Trophy, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  CheckCircle2, 
  Globe, 
  Sun, 
  Moon, 
  Target,
  Zap
} from "lucide-react";
import { cn } from './lib/utils';

// Constants
const MODEL_NAME = "gemini-1.5-flash";

interface SpecRow {
  feature: string;
  productAValue: string;
  productBValue: string;
}

interface ComparisonResult {
  winner: string;
  justification: string[];
  summary: string;
  specs: SpecRow[];
  sources: { title: string; uri: string }[];
}

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h1 className="text-2xl font-black uppercase tracking-tighter">Something went wrong</h1>
            <p className="text-zinc-400">The application encountered a critical error. Please refresh the page.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-green-500 text-black font-bold uppercase tracking-tighter"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function ComparisonApp() {
  const [productA, setProductA] = useState("");
  const [productB, setProductB] = useState("");
  const [purpose, setPurpose] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync theme with body class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleCompare = useCallback(async () => {
    if (!productA.trim() || !productB.trim()) {
      setError("Please enter both products to compare.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `You are a professional product comparison expert. Your goal is to provide a clear, data-driven comparison between two products based on a specific user purpose.
      - Use Google Search to find the latest technical specifications and real-world reviews.
      - Be objective and concise.
      - Ensure the final output is a valid JSON object.
      - Keep the justification points short and punchy.
      - The technical specs table should include at least 6 key features.`;

      const prompt = `Compare ${productA} and ${productB} for the purpose of: "${purpose || 'general use'}".
      1. Identify a winner.
      2. Provide a 3-bullet point justification.
      3. Provide a brief summary.
      4. Provide a detailed technical specification comparison table.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW
          },
          maxOutputTokens: 2048, // Explicitly set a reasonable limit for the response
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              winner: { type: Type.STRING },
              justification: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              summary: { type: Type.STRING },
              specs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    feature: { type: Type.STRING },
                    productAValue: { type: Type.STRING },
                    productBValue: { type: Type.STRING }
                  },
                  required: ["feature", "productAValue", "productBValue"]
                }
              }
            },
            required: ["winner", "justification", "summary", "specs"]
          }
        },
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");

      // Clean up potential markdown code blocks if the model ignored responseMimeType
      const cleanJson = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      const data = JSON.parse(cleanJson);
      
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(chunk => ({
        title: chunk.web?.title || "Source",
        uri: chunk.web?.uri || "#"
      })) || [];

      setResult({
        ...data,
        sources
      });
    } catch (err: any) {
      console.error("Comparison error:", err);
      const errorMessage = err.message || "";
      
      if (errorMessage.includes("Requested entity was not found")) {
        setError("API Key error. Please check your configuration.");
      } else if (errorMessage.includes("generation exceeded max tokens limit")) {
        setError("The comparison was too complex for the current token limit. Try a more specific purpose or simpler product names.");
      } else if (errorMessage.includes("quota")) {
        setError("API quota exceeded. Please try again later.");
      } else {
        setError("Failed to generate comparison. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [productA, productB, purpose]);

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300 font-sans selection:bg-green-500 selection:text-black",
      isDarkMode ? "bg-black text-white" : "bg-white text-black"
    )}>
      {/* Header */}
      <header className={cn(
        "border-b sticky top-0 z-50 backdrop-blur-md",
        isDarkMode ? "border-green-500/20 bg-black/80" : "border-black/10 bg-white/80"
      )}>
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-none flex items-center justify-center rotate-3 hover:rotate-0 transition-transform">
              <Trophy className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">SMART PICK AI</h1>
              <div className="text-[10px] font-mono text-green-500 uppercase tracking-[0.3em] font-bold">Verdict Engine v2.0</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={cn(
                "p-3 rounded-none border transition-all hover:bg-green-500 hover:text-black",
                isDarkMode ? "border-green-500/30 text-green-500" : "border-black/20 text-black"
              )}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Intro Section */}
        <div className="mb-12 grid lg:grid-cols-2 gap-8 items-end">
          <div>
            <h2 className="text-xl font-black mb-4 tracking-tight uppercase leading-tight">
              Settle the <span className="text-green-500">Debate.</span>
            </h2>
            <p className={cn(
              "text-base max-w-md border-l-4 border-green-500 pl-4 py-1",
              isDarkMode ? "text-zinc-400" : "text-zinc-600"
            )}>
              Advanced AI analysis of technical specifications and real-world performance data.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className={cn(
              "p-4 border-2 flex items-start gap-4",
              isDarkMode ? "bg-zinc-900 border-green-500/20" : "bg-zinc-50 border-black/10"
            )}>
              <Target className="w-5 h-5 text-green-500 shrink-0 mt-1" />
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-green-500 font-bold mb-1 block">Define Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Professional Photography, Gaming..."
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className={cn(
                    "w-full bg-transparent border-b focus:outline-none py-1 transition-all text-sm",
                    isDarkMode ? "border-zinc-800 focus:border-green-500 text-white placeholder:text-zinc-600" : "border-zinc-200 focus:border-black text-black placeholder:text-zinc-400"
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Inputs */}
        <div className="grid md:grid-cols-2 gap-0 border-2 border-green-500/20 mb-8">
          <div className={cn(
            "p-6 border-b md:border-b-0 md:border-r",
            isDarkMode ? "border-green-500/20" : "border-black/10"
          )}>
            <label className="text-[10px] font-mono uppercase tracking-widest text-green-500 font-bold mb-2 block">Contender A</label>
            <input
              type="text"
              placeholder="Enter Product Name"
              value={productA}
              onChange={(e) => setProductA(e.target.value)}
              className={cn(
                "text-xl font-bold bg-transparent w-full focus:outline-none uppercase tracking-tight",
                isDarkMode ? "text-white placeholder:text-zinc-600" : "text-black placeholder:text-zinc-400"
              )}
            />
          </div>
          <div className="p-6">
            <label className="text-[10px] font-mono uppercase tracking-widest text-green-500 font-bold mb-2 block">Contender B</label>
            <input
              type="text"
              placeholder="Enter Product Name"
              value={productB}
              onChange={(e) => setProductB(e.target.value)}
              className={cn(
                "text-xl font-bold bg-transparent w-full focus:outline-none uppercase tracking-tight",
                isDarkMode ? "text-white placeholder:text-zinc-600" : "text-black placeholder:text-zinc-400"
              )}
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col items-center gap-4 mb-16">
          <button
            onClick={handleCompare}
            disabled={isLoading}
            className={cn(
              "w-full sm:w-auto px-8 py-4 font-bold text-lg uppercase tracking-tight transition-all relative overflow-hidden group",
              isDarkMode ? "bg-green-500 text-black hover:bg-white" : "bg-black text-white hover:bg-green-500 hover:text-black"
            )}
          >
            <span className="relative z-10 flex items-center gap-3">
              {isLoading ? "Analyzing Data..." : "Generate Verdict"}
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            </span>
          </button>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500 text-white p-4 mb-8 flex items-center gap-3 font-bold uppercase tracking-tight italic"
            >
              <AlertCircle className="w-6 h-6" />
              <p className="text-base">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12"
            >
              {/* Winner Announcement */}
              <div className={cn(
                "border-2 p-8 relative",
                isDarkMode ? "bg-zinc-900 border-green-500" : "bg-zinc-50 border-black"
              )}>
                <div className="absolute -top-4 -left-4 bg-green-500 text-black px-4 py-1 font-bold uppercase tracking-tight text-sm -rotate-1">
                  The Winner
                </div>
                
                <div className="grid lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-4 break-words">
                      {result.winner}
                    </h3>
                    <p className={cn(
                      "text-base font-medium leading-relaxed mb-6 italic",
                      isDarkMode ? "text-zinc-300" : "text-zinc-700"
                    )}>
                      "{result.summary}"
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-green-500 font-bold">Core Justification</h4>
                    <ul className="space-y-3">
                      {result.justification.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 group">
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                          <span className="font-bold tracking-tight leading-tight uppercase text-xs">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Specs Table Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-black uppercase tracking-tight italic">Technical Breakdown</h3>
                  <div className="h-0.5 flex-grow bg-green-500/20"></div>
                </div>

                <div className={cn(
                  "overflow-x-auto border",
                  isDarkMode ? "border-green-500/20" : "border-black/10"
                )}>
                  <table className="w-full min-w-[600px] text-left border-collapse">
                    <thead>
                      <tr className={cn(
                        "text-[9px] font-mono uppercase tracking-[0.2em] font-bold",
                        isDarkMode ? "bg-zinc-900 text-green-500" : "bg-zinc-100 text-black"
                      )}>
                        <th className="p-4 border-r border-green-500/10">Feature</th>
                        <th className="p-4 border-r border-green-500/10 truncate max-w-[120px]">{productA || 'Product A'}</th>
                        <th className="p-4">{productB || 'Product B'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-500/10">
                      {result.specs.map((spec, i) => (
                        <tr key={i} className={cn(
                          "transition-colors text-sm",
                          isDarkMode ? "hover:bg-green-500/5" : "hover:bg-zinc-50"
                        )}>
                          <td className={cn(
                            "p-4 font-bold uppercase tracking-tight border-r shrink-0",
                            isDarkMode ? "border-green-500/10 text-zinc-400" : "border-black/10 text-zinc-500"
                          )}>
                            {spec.feature}
                          </td>
                          <td className={cn(
                            "p-4 font-medium tracking-tight border-r",
                            isDarkMode ? "border-green-500/10 text-white" : "border-black/10 text-black",
                            spec.productAValue.toLowerCase().includes('winner') || spec.productAValue.toLowerCase().includes('better') ? 'text-green-500' : ''
                          )}>
                            {spec.productAValue}
                          </td>
                          <td className={cn(
                            "p-4 font-medium tracking-tight",
                            isDarkMode ? "text-white" : "text-black",
                            spec.productBValue.toLowerCase().includes('winner') || spec.productBValue.toLowerCase().includes('better') ? 'text-green-500' : ''
                          )}>
                            {spec.productBValue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sources */}
              {result.sources.length > 0 && (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <h4 className="text-xs font-mono uppercase tracking-[0.3em] text-green-500 font-bold shrink-0">Evidence Found</h4>
                    <div className="h-[1px] flex-grow bg-green-500/20"></div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {result.sources.map((source, i) => (
                      <a
                        key={i}
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "px-6 py-3 font-bold text-xs uppercase tracking-tighter border-2 transition-all flex items-center gap-3",
                          isDarkMode 
                            ? "border-green-500/20 text-green-500 hover:bg-green-500 hover:text-black" 
                            : "border-black/10 text-black hover:bg-black hover:text-white"
                        )}
                      >
                        <Globe className="w-4 h-4" />
                        {source.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Skeleton */}
        {isLoading && !result && (
          <div className="space-y-12 animate-pulse">
            <div className={cn(
              "h-96 border-4",
              isDarkMode ? "bg-zinc-900 border-green-500/20" : "bg-zinc-100 border-black/5"
            )} />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={cn(
                  "h-16 border-2",
                  isDarkMode ? "bg-zinc-900/50 border-green-500/10" : "bg-zinc-50 border-black/5"
                )} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={cn(
        "border-t py-20 mt-32",
        isDarkMode ? "border-green-500/10 text-zinc-600" : "border-black/5 text-zinc-400"
      )}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <Trophy className="w-6 h-6 text-green-500" />
            <span className="text-xl font-black uppercase tracking-tighter italic">SMART PICK AI</span>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-center md:text-right">
            System Status: Nominal // Data Integrity: Verified
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ComparisonApp />
    </ErrorBoundary>
  );
}
