import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import RequireCompletion from "@/components/RequireCompletion";

import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import DeleteAccount from "./pages/DeleteAccount";
import Admin from "./pages/Admin";
import OAuthCallback from "./pages/OAuthCallback";
import NotFound from "./pages/NotFound";

import ChatLayout from "./pages/chat/ChatLayout";
import ChatHome from "./pages/chat/ChatHome";
import ChatFriends from "./pages/chat/ChatFriends";
import ChatSearch from "./pages/chat/ChatSearch";
import ChatNotifications from "./pages/chat/ChatNotifications";
import ChatSettings from "./pages/chat/ChatSettings";
import ChatPrivacy from "./pages/chat/ChatPrivacy";
import ChatSafety from "./pages/chat/ChatSafety";
import ChatGuidelines from "./pages/chat/ChatGuidelines";
import ChatConversation from "./pages/chat/ChatConversation";
import ChatProfile from "./pages/chat/ChatProfile";
import GroupsList from "./pages/chat/GroupsList";
import CreateGroup from "./pages/chat/Group";
import JoinGroup from "./pages/chat/JoinGroup";
import GroupChat from "./pages/chat/GroupChat";
import UsernameSetup from "./pages/chat/UsernameSetup";
import StoryViewer from "./components/chat/StoryViewer";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />

          {/* إعداد اسم المستخدم — لازم يفضل برا حراسة RequireCompletion
              عشان مايحصلش لوب لا نهائي (اليوزر اللي مالوش يوزرنيم بيتحول
              هنا، فلو الصفحة نفسها محروسة هيترحّل لنفسه تاني وتاني) */}
          <Route path="/chat/setup" element={<UsernameSetup />} />

          <Route
            path="/chat"
            element={
              <RequireCompletion>
                <ChatLayout />
              </RequireCompletion>
            }
          >
            <Route index element={<ChatHome />} />
            <Route path="friends" element={<ChatFriends />} />
            <Route path="search" element={<ChatSearch />} />
            <Route path="notifications" element={<ChatNotifications />} />
            <Route path="settings" element={<ChatSettings />} />
            <Route path="privacy" element={<ChatPrivacy />} />
            <Route path="safety" element={<ChatSafety />} />
            <Route path="guidelines" element={<ChatGuidelines />} />
            <Route path="c/:id" element={<ChatConversation />} />
            <Route path="u/:username" element={<ChatProfile />} />
            <Route path="groups" element={<GroupsList />} />
            <Route path="groups/new" element={<CreateGroup />} />
            <Route path="groups/join" element={<JoinGroup />} />
            <Route path="groups/join/:code" element={<JoinGroup />} />
            <Route path="g/:id" element={<GroupChat />} />
            <Route path="story/:userId" element={<StoryViewer />} />
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
