import type { ProgramStatusReport } from 'ntwebterm';

export type { ProgramStatusReport };

export interface ProgramStatusSource {
    onProgramStatus?: (listener: (report: ProgramStatusReport) => void) => { dispose(): void };
}

