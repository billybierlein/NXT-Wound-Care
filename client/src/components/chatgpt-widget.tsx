import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Send, Loader2, Stethoscope, FileText, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatGPTWidget() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  
  // Wound Assessment form state
  const [woundDescription, setWoundDescription] = useState("");
  const [patientInfo, setPatientInfo] = useState("");
  
  // Treatment Protocol form state
  const [woundType, setWoundType] = useState("");
  const [severity, setSeverity] = useState("");
  
  const { toast } = useToast();

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest('POST', '/api/chat', { question });
      return response.json();
    },
    onSuccess: (data: { response: string }) => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.response, timestamp: new Date() }
      ]);
      setQuestion("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to get response from ChatGPT",
        variant: "destructive",
      });
    },
  });

  const assessmentMutation = useMutation({
    mutationFn: async ({ woundDescription, patientInfo }: { woundDescription: string; patientInfo?: string }) => {
      const response = await apiRequest('POST', '/api/wound-assessment', { woundDescription, patientInfo });
      return response.json();
    },
    onSuccess: (data: { assessment: string }) => {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: `Wound Assessment Request: ${woundDescription}`, timestamp: new Date() },
        { role: 'assistant', content: data.assessment, timestamp: new Date() }
      ]);
      setWoundDescription("");
      setPatientInfo("");
      setActiveTab("chat");
    },
    onError: (error: Error) => {
      toast({
        title: "Assessment Error",
        description: error.message || "Failed to generate wound assessment",
        variant: "destructive",
      });
    },
  });

  const protocolMutation = useMutation({
    mutationFn: async ({ woundType, severity }: { woundType: string; severity: string }) => {
      const response = await apiRequest('POST', '/api/treatment-protocol', { woundType, severity });
      return response.json();
    },
    onSuccess: (data: { protocol: string }) => {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: `Treatment Protocol Request: ${woundType} - ${severity}`, timestamp: new Date() },
        { role: 'assistant', content: data.protocol, timestamp: new Date() }
      ]);
      setWoundType("");
      setSeverity("");
      setActiveTab("chat");
    },
    onError: (error: Error) => {
      toast({
        title: "Protocol Error",
        description: error.message || "Failed to generate treatment protocol",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    // Add user message to chat
    const userMessage: ChatMessage = {
      role: 'user',
      content: question.trim(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Send to ChatGPT
    chatMutation.mutate(question.trim());
  };

  const handleAssessmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!woundDescription.trim()) return;
    assessmentMutation.mutate({ woundDescription: woundDescription.trim(), patientInfo: patientInfo.trim() || undefined });
  };

  const handleProtocolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!woundType || !severity) return;
    protocolMutation.mutate({ woundType, severity });
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
        size="icon"
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-[480px] h-[600px] shadow-xl z-50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-blue-600" />
            Medical Insights AI
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              disabled={messages.length === 0}
              className="text-xs h-8"
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-xs h-8"
            >
              ✕
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col h-full pb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="text-xs">
              <MessageCircle className="h-3 w-3 mr-1" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="assessment" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Assessment
            </TabsTrigger>
            <TabsTrigger value="protocol" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              Protocol
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col mt-4">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  <Stethoscope className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="mb-2">Advanced Wound Care AI Assistant</p>
                  <p className="text-xs">Ask clinical questions, request assessments, or get treatment protocols!</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-50 text-blue-900 ml-6 border-l-4 border-blue-300'
                        : 'bg-green-50 text-green-900 mr-6 border-l-4 border-green-300'
                    }`}
                  >
                    <div className="font-medium text-xs mb-1 flex items-center gap-1">
                      {message.role === 'user' ? (
                        <>
                          <MessageCircle className="h-3 w-3" />
                          You
                        </>
                      ) : (
                        <>
                          <Stethoscope className="h-3 w-3" />
                          Medical AI
                        </>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                  </div>
                ))
              )}
              {(chatMutation.isPending || assessmentMutation.isPending || protocolMutation.isPending) && (
                <div className="bg-green-50 text-green-900 mr-6 p-3 rounded-lg text-sm border-l-4 border-green-300">
                  <div className="font-medium text-xs mb-1 flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" />
                    Medical AI
                  </div>
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing clinical data...
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about wound care, treatment options, clinical protocols..."
                className="resize-none text-sm"
                rows={2}
                disabled={chatMutation.isPending}
              />
              <Button
                type="submit"
                disabled={!question.trim() || chatMutation.isPending}
                size="sm"
                className="self-end bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="assessment" className="flex-1 flex flex-col mt-4">
            <div className="mb-4">
              <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Wound Assessment Analysis
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                Get comprehensive wound analysis and clinical recommendations
              </p>
            </div>

            <form onSubmit={handleAssessmentSubmit} className="flex flex-col gap-4 flex-1">
              <div>
                <label className="block text-xs font-medium mb-1">Wound Description *</label>
                <Textarea
                  value={woundDescription}
                  onChange={(e) => setWoundDescription(e.target.value)}
                  placeholder="Describe wound characteristics: location, size, depth, exudate, tissue type, surrounding skin condition..."
                  className="resize-none text-sm"
                  rows={3}
                  disabled={assessmentMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Patient Information (Optional)</label>
                <Textarea
                  value={patientInfo}
                  onChange={(e) => setPatientInfo(e.target.value)}
                  placeholder="Patient age, medical history, medications, mobility status, nutrition..."
                  className="resize-none text-sm"
                  rows={2}
                  disabled={assessmentMutation.isPending}
                />
              </div>

              <Button
                type="submit"
                disabled={!woundDescription.trim() || assessmentMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
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
            </form>
          </TabsContent>

          <TabsContent value="protocol" className="flex-1 flex flex-col mt-4">
            <div className="mb-4">
              <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-600" />
                Treatment Protocol Generator
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                Get evidence-based treatment protocols for specific wound types
              </p>
            </div>

            <form onSubmit={handleProtocolSubmit} className="flex flex-col gap-4 flex-1">
              <div>
                <label className="block text-xs font-medium mb-1">Wound Type *</label>
                <Select value={woundType} onValueChange={setWoundType}>
                  <SelectTrigger className="text-sm">
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
                <label className="block text-xs font-medium mb-1">Severity Level *</label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger className="text-sm">
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
                type="submit"
                disabled={!woundType || !severity || protocolMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700"
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
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}