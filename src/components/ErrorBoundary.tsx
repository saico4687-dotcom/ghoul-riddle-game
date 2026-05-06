import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("App ErrorBoundary:", error, info);
  }

  handleReload = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center"
        >
          <div className="max-w-md w-full bg-card/60 border border-horror-blood/40 rounded-xl p-8 backdrop-blur-sm">
            <h1
              className="font-horror text-4xl text-blood mb-4"
              style={{ textShadow: "0 0 20px hsl(var(--horror-blood) / 0.6)" }}
            >
              حدث خطأ غير متوقع
            </h1>
            <p className="font-typewriter text-muted-foreground mb-6 leading-relaxed">
              يبدو أن شيئًا مظلمًا قد قاطع التطبيق. لا تقلق — بياناتك محفوظة.
              حاول إعادة تحميل الصفحة للمتابعة.
            </p>

            {this.state.error?.message && (
              <pre className="text-xs text-left text-muted-foreground/70 bg-background/40 p-3 rounded mb-6 overflow-auto max-h-32 font-mono">
                {this.state.error.message}
              </pre>
            )}

            <button
              onClick={this.handleReload}
              className="btn-horror font-horror text-lg px-8 py-3 rounded-lg w-full"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
