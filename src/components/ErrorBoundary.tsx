"use client";

import { clearAppStorage } from "@/lib/storage-reset";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[voicebudget]", error, info);
  }

  handleReset = () => {
    clearAppStorage();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-lg font-semibold">Ошибка загрузки</h1>
          <p className="text-sm text-muted-foreground">
            Скорее всего повреждён кэш в браузере. Нажмите кнопку ниже — данные приложения на
            этом устройстве сбросятся, страница откроется заново.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Сбросить данные и открыть снова
          </button>
          <p className="text-xs text-muted-foreground">
            Или: Cmd+Shift+R и удалите в DevTools → Application → Local Storage ключ{" "}
            <code className="text-foreground">voicebudget-store</code>
          </p>
        </main>
      );
    }
    return this.props.children;
  }
}
