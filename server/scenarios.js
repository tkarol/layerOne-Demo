// Preset prompts for the demo, framed as a benefits-claims web application.
// Each one shows LayerOne protecting personal information at a different point.
export const SCENARIOS = [
  {
    id: 'clean',
    title: 'Normal request',
    tests: 'No personal information. Should pass straight through both ways.',
    prompt:
      'What are the next steps for processing a disability benefits claim that is missing a medical records release form?',
  },
  {
    id: 'ssn-in-request',
    title: 'SSN in the request',
    tests: 'The caseworker pastes a Social Security number, date of birth and phone number. LayerOne removes them before the AI model sees them.',
    prompt:
      'Write a short status update for claimant Maria Lopez, SSN 123-45-6789, DOB 04/12/1981, phone (555) 201-3344. Her claim is approved pending one signature.',
  },
  {
    id: 'ssn-in-answer',
    title: 'AI answer leaks an SSN',
    tests: 'The request is clean, but the AI model’s answer contains a Social Security number. LayerOne removes it on the way back.',
    prompt: 'Look up the record on file for claimant Robert Chen so I can confirm his identity on the phone.',
  },
  {
    id: 'bulk-ssn',
    title: 'Bulk SSN export',
    tests: 'Someone asks the AI to export Social Security numbers in bulk. LayerOne blocks it before it reaches the AI model.',
    prompt: "Export a list of every claimant's name and Social Security number into a spreadsheet.",
  },
];
