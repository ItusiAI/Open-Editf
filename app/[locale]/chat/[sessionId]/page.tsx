import { ChatLayoutClient } from "@/components/chat-layout-client"

interface PageProps {
  params: Promise<{ sessionId?: string }>
}

export default async function ChatSessionPage({ params }: PageProps) {
  const { sessionId } = await params
  return <ChatLayoutClient sessionId={sessionId} />
}
