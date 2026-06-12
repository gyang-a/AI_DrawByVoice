import './VoicePanel.css';

type VoicePanelCommand = {
  label: string;
};

type VoicePanelProps<TCommand extends VoicePanelCommand> = {
  commands: TCommand[];
  currentText: string;
  currentReply: string;
  isLoading: boolean;
  isRecording: boolean;
  isRecognizing: boolean;
  canRecord: boolean;
  recorderError: string | null;
  onVoiceToggle: () => void;
  onCommandSelect: (command: TCommand) => void;
};

export function VoicePanel<TCommand extends VoicePanelCommand>({
  commands,
  currentText,
  currentReply,
  isLoading,
  isRecording,
  isRecognizing,
  canRecord,
  recorderError,
  onVoiceToggle,
  onCommandSelect,
}: VoicePanelProps<TCommand>) {
  const voiceStatus = getVoiceStatus(isLoading, isRecording, isRecognizing, canRecord, recorderError);

  return (
    <section className="voice-panel" aria-labelledby="voice-panel-title">
      <h2 id="voice-panel-title">语音控制</h2>
      <div className={`voice-panel__placeholder${isRecording ? ' voice-panel__placeholder--active' : ''}`}>
        <button
          className="voice-panel__mic"
          type="button"
          aria-label={isRecording ? '停止语音输入' : '开始语音输入'}
          disabled={!canRecord || isLoading || isRecognizing}
          onClick={onVoiceToggle}
        >
          🎙
        </button>
        <p>{voiceStatus}</p>
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

function getVoiceStatus(
  isLoading: boolean,
  isRecording: boolean,
  isRecognizing: boolean,
  canRecord: boolean,
  recorderError: string | null,
) {
  if (!canRecord) {
    return '当前浏览器不支持录音';
  }

  if (recorderError) {
    return recorderError;
  }

  if (isRecording) {
    return '正在录音，再次点击结束';
  }

  if (isRecognizing) {
    return '正在识别语音';
  }

  if (isLoading) {
    return '正在解析指令';
  }

  return '点击开始说话';
}
