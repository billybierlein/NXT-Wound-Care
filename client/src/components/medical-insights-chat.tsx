import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Stethoscope, 
  Send, 
  MessageCircle, 
  Loader2,
  FileText,
  Target,
  Mic,
  Settings
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function MedicalInsightsChat() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeMode, setActiveMode] = useState("chat");
  
  // Wound Assessment form state
  const [woundDescription, setWoundDescription] = useState("");
  const [patientInfo, setPatientInfo] = useState("");
  
  // Treatment Protocol form state
  const [woundType, setWoundType] = useState("");
  const [severity, setSeverity] = useState("");
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest("POST", "/api/chat", { question });
      return response.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.response, 
        timestamp: new Date() 
      }]);
      setQuestion("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const assessmentMutation = useMutation({
    mutationFn: async (data: { woundDescription: string; patientInfo?: string }) => {
      const response = await apiRequest("POST", "/api/wound-assessment", data);
      return response.json();
    },
    onSuccess: (data) => {
      const userMessage = `Wound Assessment Request: ${woundDescription}${patientInfo ? `, Patient Info: ${patientInfo}` : ''}`;
      setMessages(prev => [
        ...prev,
        { role: "user", content: userMessage, timestamp: new Date() },
        { role: "assistant", content: data.assessment, timestamp: new Date() }
      ]);
      setWoundDescription("");
      setPatientInfo("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate assessment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const protocolMutation = useMutation({
    mutationFn: async (data: { woundType: string; severity: string }) => {
      const response = await apiRequest("POST", "/api/treatment-protocol", data);
      return response.json();
    },
    onSuccess: (data) => {
      const userMessage = `Treatment Protocol Request: ${woundType.replace('-', ' ')} - ${severity} severity`;
      setMessages(prev => [
        ...prev,
        { role: "user", content: userMessage, timestamp: new Date() },
        { role: "assistant", content: data.protocol, timestamp: new Date() }
      ]);
      setWoundType("");
      setSeverity("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate protocol. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || chatMutation.isPending) return;

    setMessages(prev => [...prev, { 
      role: "user", 
      content: question, 
      timestamp: new Date() 
    }]);
    
    chatMutation.mutate(question);
  };

  const handleAssessmentSubmit = () => {
    if (!woundDescription.trim() || assessmentMutation.isPending) return;
    assessmentMutation.mutate({ woundDescription, patientInfo });
  };

  const handleProtocolSubmit = () => {
    if (!woundType || !severity || protocolMutation.isPending) return;
    protocolMutation.mutate({ woundType, severity });
  };

  const clearConversation = () => {
    setMessages([]);
    setQuestion("");
    setWoundDescription("");
    setPatientInfo("");
    setWoundType("");
    setSeverity("");
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Stethoscope className="h-8 w-8 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-900">Medical Insights AI</h2>
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Advanced wound care assistance powered by AI. Get clinical insights, assessments, and treatment protocols.
        </p>
      </div>

      {/* Mode Selection */}
      <div className="flex justify-center mb-6">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveMode("chat")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeMode === "chat" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <MessageCircle className="h-4 w-4 inline mr-2" />
            Chat
          </button>
          <button
            onClick={() => setActiveMode("assessment")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeMode === "assessment" 
                ? "bg-white text-green-600 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Assessment
          </button>
          <button
            onClick={() => setActiveMode("protocol")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeMode === "protocol" 
                ? "bg-white text-orange-600 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Target className="h-4 w-4 inline mr-2" />
            Protocol
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      {messages.length > 0 && (
        <Card className="mb-6 p-0 overflow-hidden">
          <div className="max-h-96 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl px-4 py-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-1">
                    {message.role === 'user' ? (
                      <MessageCircle className="h-4 w-4 mt-0.5" />
                    ) : (
                      <Stethoscope className="h-4 w-4 mt-0.5" />
                    )}
                    <span className="font-medium text-sm">
                      {message.role === 'user' ? 'You' : 'Medical AI'}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t p-4 bg-gray-50">
            <Button
              onClick={clearConversation}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Clear Conversation
            </Button>
          </div>
        </Card>
      )}

      {/* Input Area */}
      <Card className="p-6">
        {activeMode === "chat" && (
          <div>
            <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              Ask Medical AI
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about wound care, treatment options, clinical protocols..."
                  className="resize-none pr-12 min-h-[100px]"
                  disabled={chatMutation.isPending}
                />
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    type="submit"
                    disabled={!question.trim() || chatMutation.isPending}
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    {chatMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {activeMode === "assessment" && (
          <div>
            <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Wound Assessment Analysis
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Wound Description *</label>
                <Textarea
                  value={woundDescription}
                  onChange={(e) => setWoundDescription(e.target.value)}
                  placeholder="Describe wound characteristics: location, size, depth, exudate, tissue type, surrounding skin condition..."
                  className="resize-none min-h-[100px]"
                  disabled={assessmentMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Patient Information (Optional)</label>
                <Textarea
                  value={patientInfo}
                  onChange={(e) => setPatientInfo(e.target.value)}
                  placeholder="Patient age, medical history, medications, mobility status, nutrition..."
                  className="resize-none"
                  rows={3}
                  disabled={assessmentMutation.isPending}
                />
              </div>

              <Button
                onClick={handleAssessmentSubmit}
                disabled={!woundDescription.trim() || assessmentMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {assessmentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Assessment
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {activeMode === "protocol" && (
          <div>
            <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-600" />
              Treatment Protocol Generator
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Wound Type *</label>
                <Select value={woundType} onValueChange={setWoundType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wound type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pressure-ulcer">Pressure Ulcer</SelectItem>
                    <SelectItem value="diabetic-ulcer">Diabetic Foot Ulcer</SelectItem>
                    <SelectItem value="venous-ulcer">Venous Leg Ulcer</SelectItem>
                    <SelectItem value="arterial-ulcer">Arterial Ulcer</SelectItem>
                    <SelectItem value="surgical-wound">Surgical Wound</SelectItem>
                    <SelectItem value="traumatic-wound">Traumatic Wound</SelectItem>
                    <SelectItem value="burns">Burn Injury</SelectItem>
                    <SelectItem value="chronic-wound">Chronic Wound</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Severity Level *</label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild (Stage I-II)</SelectItem>
                    <SelectItem value="moderate">Moderate (Stage II-III)</SelectItem>
                    <SelectItem value="severe">Severe (Stage III-IV)</SelectItem>
                    <SelectItem value="critical">Critical/Complex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleProtocolSubmit}
                disabled={!woundType || !severity || protocolMutation.isPending}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {protocolMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Target className="h-4 w-4 mr-2" />
                    Generate Protocol
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}