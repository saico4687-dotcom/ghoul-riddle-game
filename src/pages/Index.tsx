import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isPast, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus, LogOut, Pencil, Trash2, CalendarClock, CheckCircle2, Loader2, ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Priority = "high" | "medium" | "low";
type Todo = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  deadline: string | null;
  completed: boolean;
  created_at: string;
};

type Profile = { name: string | null; email: string | null; profile_image: string | null };

const priorityStyles: Record<Priority, { dot: string; label: string; badge: string }> = {
  high:   { dot: "bg-[hsl(var(--priority-high))]",   label: "High",   badge: "bg-[hsl(var(--priority-high))]/10 text-[hsl(var(--priority-high))]" },
  medium: { dot: "bg-[hsl(var(--priority-medium))]", label: "Medium", badge: "bg-[hsl(var(--priority-medium))]/10 text-[hsl(var(--priority-medium))]" },
  low:    { dot: "bg-[hsl(var(--priority-low))]",    label: "Low",    badge: "bg-[hsl(var(--priority-low))]/10 text-[hsl(var(--priority-low))]" },
};

export default function Index() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) navigate("/auth", { replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) navigate("/auth", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from("todos").select("*").order("completed").order("deadline", { ascending: true, nullsFirst: false }),
        supabase.from("profiles").select("name, email, profile_image").eq("user_id", session.user.id).maybeSingle(),
      ]);
      setTodos((t as Todo[]) ?? []);
      setProfile(p as Profile);
      setLoading(false);
    })();
  }, [session]);

  const resetForm = () => {
    setTitle(""); setDescription(""); setPriority("medium"); setDeadline(""); setEditing(null);
  };

  const openNew = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (t: Todo) => {
    setEditing(t);
    setTitle(t.title);
    setDescription(t.description ?? "");
    setPriority(t.priority);
    setDeadline(t.deadline ? format(new Date(t.deadline), "yyyy-MM-dd'T'HH:mm") : "");
    setDialogOpen(true);
  };

  const saveTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : null,
    };
    try {
      if (editing) {
        const { data, error } = await supabase.from("todos").update(payload).eq("id", editing.id).select().single();
        if (error) throw error;
        setTodos((prev) => prev.map((x) => (x.id === editing.id ? (data as Todo) : x)));
        toast.success("Task updated");
      } else {
        const { data, error } = await supabase.from("todos").insert({ ...payload, user_id: session.user.id }).select().single();
        if (error) throw error;
        setTodos((prev) => [data as Todo, ...prev]);
        toast.success("Task added");
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (t: Todo) => {
    const next = !t.completed;
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: next } : x)));
    const { error } = await supabase.from("todos").update({ completed: next }).eq("id", t.id);
    if (error) {
      toast.error("Couldn't update");
      setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: !next } : x)));
    }
  };

  const removeTodo = async (id: string) => {
    const prev = todos;
    setTodos((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete"); setTodos(prev); }
    else toast.success("Task deleted");
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const active = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);
  const displayName = profile?.name || session?.user.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {profile?.profile_image ? (
              <img src={profile.profile_image} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[image:var(--gradient-primary)] flex items-center justify-center text-primary-foreground font-semibold text-sm">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Hello,</p>
              <p className="font-semibold truncate">{displayName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-32">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ListTodo className="w-7 h-7 text-primary" /> Your tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {active.length} active · {done.length} done
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : todos.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">No tasks yet</h3>
            <p className="text-muted-foreground text-sm mt-1">Tap the + button to add your first task.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((t) => <TodoItem key={t.id} todo={t} onToggle={toggleComplete} onEdit={openEdit} onDelete={removeTodo} />)}
            {done.length > 0 && (
              <>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mt-8 mb-2 px-1">Completed</h2>
                {done.map((t) => <TodoItem key={t.id} todo={t} onToggle={toggleComplete} onEdit={openEdit} onDelete={removeTodo} />)}
              </>
            )}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogTrigger asChild>
          <Button
            onClick={openNew}
            size="icon"
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-[var(--shadow-soft)] bg-[image:var(--gradient-primary)] hover:opacity-90"
            aria-label="New task"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveTodo} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="What needs doing?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high"><span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[hsl(var(--priority-high))]" />High</span></SelectItem>
                    <SelectItem value="medium"><span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[hsl(var(--priority-medium))]" />Medium</span></SelectItem>
                    <SelectItem value="low"><span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[hsl(var(--priority-low))]" />Low</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deadline">Deadline</Label>
                <Input id="deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !title.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save changes" : "Add task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TodoItem({
  todo, onToggle, onEdit, onDelete,
}: {
  todo: Todo;
  onToggle: (t: Todo) => void;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
}) {
  const ps = priorityStyles[todo.priority];
  const deadlineDate = todo.deadline ? new Date(todo.deadline) : null;
  const overdue = !todo.completed && deadlineDate && isPast(deadlineDate) && !isToday(deadlineDate);

  return (
    <div className={cn(
      "group bg-card border rounded-xl p-3 flex items-start gap-3 transition-all hover:shadow-md",
      todo.completed && "opacity-60"
    )}>
      <Checkbox checked={todo.completed} onCheckedChange={() => onToggle(todo)} className="mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn("font-medium leading-tight", todo.completed && "line-through")}>{todo.title}</h3>
          <span className={cn("text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full whitespace-nowrap", ps.badge)}>
            {ps.label}
          </span>
        </div>
        {todo.description && <p className="text-sm text-muted-foreground mt-1 break-words">{todo.description}</p>}
        {deadlineDate && (
          <div className={cn("flex items-center gap-1 text-xs mt-2", overdue ? "text-destructive" : "text-muted-foreground")}>
            <CalendarClock className="w-3.5 h-3.5" />
            {format(deadlineDate, "MMM d, yyyy · h:mm a")}
            {overdue && <span className="font-semibold">· Overdue</span>}
          </div>
        )}
        <div className="flex gap-1 mt-2 -ml-2">
          <Button size="sm" variant="ghost" onClick={() => onEdit(todo)} className="h-7 px-2 text-xs">
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(todo.id)} className="h-7 px-2 text-xs text-destructive hover:text-destructive">
            <Trash2 className="w-3 h-3 mr-1" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
