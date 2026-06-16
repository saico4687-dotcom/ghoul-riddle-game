import { Link } from "react-router-dom";
import { Shield, BookOpen, FileText, Ban, Flag } from "lucide-react";

export default function ChatSafety() {
  return (
    <div className="p-6" dir="rtl">
      <h1 className="font-horror text-3xl text-primary mb-4">مركز السلامة</h1>
      <p className="font-typewriter text-sm text-foreground/80 mb-6">
        نهتم بسلامتك في الدردشة. هذه أدواتك وحقوقك:
      </p>

      <div className="space-y-3">
        <div className="card-horror p-4">
          <div className="flex items-center gap-2 mb-2"><Ban className="w-5 h-5 text-destructive" /><h2 className="font-horror text-foreground">حظر المستخدمين</h2></div>
          <p className="text-sm font-typewriter text-foreground/80">يمكنك حظر أي مستخدم من بروفايله أو من شاشة المحادثة. المحظور لن يقدر يراسلك أو يرى ملفك.</p>
        </div>
        <div className="card-horror p-4">
          <div className="flex items-center gap-2 mb-2"><Flag className="w-5 h-5 text-destructive" /><h2 className="font-horror text-foreground">الإبلاغ</h2></div>
          <p className="text-sm font-typewriter text-foreground/80">ابلِّغ عن أي مستخدم أو رسالة مسيئة. يراجع فريق الإشراف كل البلاغات. تكرار البلاغات يؤدي تلقائياً لكتم ثم إيقاف المستخدم.</p>
        </div>
        <Link to="/chat/guidelines" className="card-horror p-4 flex items-center gap-3 hover:border-primary/60">
          <BookOpen className="w-5 h-5 text-primary" />
          <div><h2 className="font-horror text-foreground">إرشادات المجتمع</h2><p className="text-xs text-muted-foreground font-typewriter">السلوك المسموح والممنوع</p></div>
        </Link>
        <Link to="/chat/privacy" className="card-horror p-4 flex items-center gap-3 hover:border-primary/60">
          <FileText className="w-5 h-5 text-primary" />
          <div><h2 className="font-horror text-foreground">سياسة الخصوصية</h2><p className="text-xs text-muted-foreground font-typewriter">كيف نتعامل مع بياناتك</p></div>
        </Link>
      </div>
    </div>
  );
}
