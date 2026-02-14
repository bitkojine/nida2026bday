import loader from '@monaco-editor/loader';

export interface CodeEditor {
  getValue(): string;
  setValue(next: string): void;
  onDidChangeModelContent(listener: () => void): void;
  dispose(): void;
}

export async function mountMonacoEditor(el: HTMLElement, initial: string): Promise<CodeEditor> {
  loader.config({ monaco });
  const monacoApi = await loader.init();

  const editor = monacoApi.editor.create(el, {
    value: initial,
    language: 'csharp',
    theme: 'vs',
    fontSize: 11,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    lineNumbersMinChars: 2,
    wordWrap: 'on',
  });

  return editor;
}

declare const monaco: {
  editor: {
    create: (node: HTMLElement, options: Record<string, unknown>) => CodeEditor;
  };
};
