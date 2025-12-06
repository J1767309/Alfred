import Header from '@/components/layout/Header';
import ChatContainer from '@/components/chat/ChatContainer';

export default function ChatPage() {
  return (
    <>
      <Header
        title="Chat with Alfred"
        subtitle="Ask questions about your transcriptions"
      />
      <div className="flex-1 overflow-hidden">
        <ChatContainer />
      </div>
    </>
  );
}
