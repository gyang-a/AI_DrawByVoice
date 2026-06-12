import './VoicePanel.css';

type VoicePanelCommand = {
  label: string;
};

type VoicePanelProps<TCommand extends VoicePanelCommand> = {
  commands: TCommand[];
  currentText: string;
  currentReply: string;
  isLoading: boolean;
  onCommandSelect: (command: TCommand) => void;
};

export function VoicePanel<TCommand extends VoicePanelCommand>({
  commands,
  currentText,
  currentReply,
  isLoading,
  onCommandSelect,
}: VoicePanelProps<TCommand>) {
  return (
    <section className="voice-panel" aria-labelledby="voice-panel-title">
      <h2 id="voice-panel-title">语音控制</h2>
      <div className="voice-panel__placeholder">
        <button className="voice-panel__mic" type="button" aria-label="开始语音输入">
          🎙
        </button>
        <p>{isLoading ? '正在解析指令' : '点击开始说话'}</p>
      </div>
      <div className="voice-panel__section">
        <h3>识别文本</h3>
        <p className="voice-panel__box">{currentText}</p>
      </div>
      <div className="voice-panel__section">
        <h3>AI 回复</h3>
        <p className="voice-panel__box voice-panel__box--reply">
          {currentReply}
        </p>
      </div>
      <div className="voice-panel__section">
        <h3>快捷指令（测试用）</h3>
        <div className="voice-panel__quick-actions" aria-label="快捷指令占位">
          {commands.map((command) => (
            <button
              key={command.label}
              type="button"
              disabled={isLoading}
              onClick={() => onCommandSelect(command)}
            >
              {command.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
