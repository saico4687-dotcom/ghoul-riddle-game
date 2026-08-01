import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGroups } from "@/hooks/useGroups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function JoinGroup() {
  const navigate = useNavigate();
  const { code: codeFromUrl } = useParams<{ code?: string }>();
  const { joinByInvite } = useGroups();
  const [code, setCode] = useState(codeFromUrl ?? "");
  const [joining, setJoining] = useState(false);

  const join = async () => {
    if (!code.trim()) {
      toast.error("الصق رابط أو كود الدعوة");
      return;
    }
    setJoining(true);
    try {
      // accept either a raw code or a full link ending in the code
      const raw = code.trim();
      const parts = raw.split("/").filter(Boolean);
      const inviteCode = parts[parts.length - 1];
      const groupId = await joinByInvite(inviteCode);
      toast.success("تم الانضمام للجروب");
      navigate(`/chat/g/${groupId}`, { replace: true });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("banned")) toast.error("أنت محظور من هذا الجروب");
      else if (msg.includes("invalid invite code") || msg.includes("invalid_invite_code")) toast.error("رابط الدعوة غير صالح أو تم إلغاؤه");
      else if (msg.includes("group_full")) toast.error("الجروب وصل للحد الأقصى للأعضاء (1024 عضو)");
      else toast.error(msg || "تعذر الانضمام");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-horror flex items-center gap-2">
          <Link2 className="w-5 h-5" /> الانضمام لجروب
        </h1>
      </div>

      <p className="text-sm text-muted-foreground">
        الصق رابط الدعوة أو الكود اللي بعتهولك صاحب الجروب.
      </p>

      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="كود الدعوة أو الرابط الكامل"
        onKeyDown={(e) => e.key === "Enter" && join()}
      />

      <Button onClick={join} disabled={joining || !code.trim()}>
        {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : "انضمام"}
      </Button>
    </div>
  );
}
