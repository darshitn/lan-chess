import { useState, type ReactNode } from 'react';
import { useBoardDisplay } from '../services/board-display.js';
import { DEFAULT_CUSTOM_BOARD_SIZE, DEFAULT_MAX_BOARD_SIZE } from '../services/board-sizing.js';
import { BoardDisplayControls } from './BoardControls.js';
import { ResponsiveBoardFrame } from './ResponsiveBoardFrame.js';

export function StudyBoardFrame({ children }: { children: ReactNode }) {
  const display = useBoardDisplay();
  const [measure, setMeasure] = useState({
    currentSize: DEFAULT_CUSTOM_BOARD_SIZE,
    fitSize: DEFAULT_CUSTOM_BOARD_SIZE,
    maxAllowedWidth: DEFAULT_MAX_BOARD_SIZE,
  });

  return (
    <>
      <ResponsiveBoardFrame
        sizeMode={display.sizeMode}
        customSize={display.customSize}
        onMeasuredSizeChange={setMeasure}
        onResizeCustom={display.setCustomSize}
      >
        {children}
      </ResponsiveBoardFrame>
      <div className="study-board-tools">
        <BoardDisplayControls display={display} measure={measure} allowFocus={false} />
      </div>
    </>
  );
}
