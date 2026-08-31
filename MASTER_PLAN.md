\# MULTI-AGENT AI WORKSPACE

\# MASTER DEVELOPMENT PLAN

\# Version 1.0



\---



\# 0. PROJECT OVERVIEW



Build a professional local-first Multi-Agent AI Workspace for Windows.



The application allows the user to create projects and configure multiple

specialized AI agents that can independently or collaboratively work on:



\- software development

\- research

\- debugging

\- documentation

\- analysis

\- testing

\- code review

\- other user-defined tasks



The application must feel like an IDE rather than a basic dashboard.



The final product should provide:



1\. Projects

2\. Agents

3\. Custom roles

4\. Multiple AI providers

5\. Ollama integration

6\. Claude provider abstraction

7\. Claude profile abstraction

8\. Agent memory

9\. Project-scoped workspaces

10\. File management

11\. File permissions

12\. Artifacts

13\. Artifact versions

14\. Individual agent chat

15\. Team chat

16\. @agent routing

17\. @all broadcasting

18\. Agent-to-agent communication

19\. DAG workflows

20\. Parallel execution

21\. Conditions

22\. Human approval

23\. Pause/resume

24\. Retry

25\. Cancel

26\. Run-from-node

27\. Workflow variables

28\. Context inspection

29\. Edit-before-run

30\. Workflow history

31\. Event timeline

32\. Notifications

33\. Global search

34\. Command palette

35\. IDE-like UI

36\. Resizable panels

37\. Tabs

38\. Settings

39\. Provider diagnostics

40\. Security controls

41\. Testing

42\. Documentation



The application must be extensible.



\---



\# 1. CRITICAL SECURITY AND ETHICAL REQUIREMENTS



These rules apply to the ENTIRE project.



DO NOT implement:



\- browser cookie scraping

\- session-cookie extraction

\- authentication-token theft

\- browser local-storage credential extraction

\- CAPTCHA bypass

\- login bypass

\- automated account creation

\- credential harvesting

\- provider security bypass

\- rate-limit bypass

\- usage-limit bypass

\- fake authentication

\- fake provider usage

\- fake account status



Claude Free/web accounts must NOT be automated through unofficial

credential/session extraction.



Claude profiles are an architectural abstraction.



They must NOT imply that multiple Claude Free accounts can automatically

be operated unless a legitimate supported integration actually exists.



If no official supported mechanism exists:



display:



MANUAL AUTHENTICATION REQUIRED



and:



UNSUPPORTED FOR AUTOMATED WEB-ACCOUNT OPERATION



Never pretend that a profile is authenticated.



API credentials must remain backend-side.



Never expose credentials to the frontend.



Never commit secrets.



\---



\# 2. PRODUCT VISION



The application should resemble a combination of:



\- VS Code

\- AI agent workspace

\- workflow automation platform

\- project manager

\- local AI control center



The user should be able to open one project and see:



\-------------------------------------------------------------

TOP BAR

\-------------------------------------------------------------

Project | Provider Status | Workflow Status | Search | Settings

\-------------------------------------------------------------

LEFT SIDEBAR | CENTER WORKSPACE | RIGHT INSPECTOR

&#x20;            |                 |

Projects     | Tabs            | Agent details

Agents       | Chat            | Workflow node

Workflows    | Workflow        | File details

Files        | Files           | Run details

&#x20;            |                 |

\-------------------------------------------------------------

BOTTOM EVENT TIMELINE

\-------------------------------------------------------------



Everything should be interactive.



Avoid fake buttons.



Avoid placeholder UI.



\---



\# 3. TECHNOLOGY STACK



Frontend:



\- React

\- TypeScript

\- Vite



Backend:



\- Python

\- FastAPI



Database:



\- SQLite



ORM:



\- SQLAlchemy or SQLModel



Validation:



\- Pydantic



Workflow visualization:



\- React Flow or equivalent



Use a modern component architecture.



Use a lightweight frontend state-management solution.



Avoid unnecessary infrastructure.



DO NOT introduce:



\- PostgreSQL

\- Redis

\- Kubernetes

\- Docker



unless genuinely required and justified.



The primary target is local Windows usage.



\---



\# 4. REPOSITORY STRUCTURE



Use a clean structure similar to:



/

├── frontend/

├── backend/

├── docs/

├── tests/

├── scripts/

├── workspace/

├── .env.example

├── .gitignore

├── README.md

└── MASTER\_PLAN.md



Backend:



backend/

└── app/

&#x20;   ├── api/

&#x20;   ├── core/

&#x20;   ├── db/

&#x20;   ├── models/

&#x20;   ├── schemas/

&#x20;   ├── services/

&#x20;   ├── providers/

&#x20;   ├── agents/

&#x20;   ├── orchestration/

&#x20;   ├── workspace/

&#x20;   ├── memory/

&#x20;   ├── events/

&#x20;   └── notifications/



Frontend:



frontend/

└── src/

&#x20;   ├── components/

&#x20;   ├── pages/

&#x20;   ├── layouts/

&#x20;   ├── features/

&#x20;   ├── hooks/

&#x20;   ├── services/

&#x20;   ├── stores/

&#x20;   ├── types/

&#x20;   └── utils/



Architecture may be improved if justified.



\---



\# 5. DEVELOPMENT PRINCIPLES



Follow these principles throughout the project.



1\. Provider independence.



2\. Agent logic must not depend directly on Claude or Ollama.



3\. Workflow engine must be provider-independent.



4\. Business logic must remain outside React components.



5\. Secrets remain backend-side.



6\. Projects are isolated.



7\. Agents are configurable.



8\. Providers are pluggable.



9\. DemoProvider exists for deterministic testing.



10\. Every major subsystem must be independently testable.



11\. Prefer simple reliable implementations over unnecessary complexity.



12\. Never fake functionality.



13\. Never silently swallow errors.



14\. Use proper typing.



15\. Maintain backward compatibility with completed phases.



16\. Do not rewrite working systems without a reason.



17\. Do not create duplicate implementations.



18\. Before adding a dependency, determine whether an existing dependency

already solves the problem.



19\. Keep documentation synchronized with implementation.



20\. Every completed phase must pass its verification gate.



\---



\# 6. PHASE 0 — FOUNDATION



Create the initial application.



Implement:



FastAPI backend.



React/Vite frontend.



SQLite.



Environment configuration.



Logging.



CORS.



Error handling.



Health endpoint:



GET /api/health



Return:



status

version

environment



Frontend must display backend connectivity.



Create:



README.md



docs/architecture.md



docs/development.md



Create testing infrastructure.



Verify:



\- backend starts

\- frontend starts

\- database initializes

\- frontend reaches backend

\- backend tests run

\- TypeScript check passes

\- frontend production build passes



DO NOT implement later-phase functionality.



COMPLETION GATE:



Phase 0 is complete only when the basic application runs cleanly.



\---



\# 7. PHASE 1 — DATABASE AND CORE BACKEND



Create persistent models.



Models:



Project

Agent

Role

Provider

Profile

Workflow

WorkflowNode

WorkflowEdge

WorkflowRun

WorkflowNodeRun

Message

Artifact

ArtifactVersion

AgentMemory

Event

Notification

Setting



Use:



foreign keys

indexes

timestamps

validation



Implement project CRUD.



Implement agent CRUD.



Implement role CRUD.



Implement provider CRUD.



Implement profile CRUD.



API groups:



/api/projects

/api/agents

/api/roles

/api/providers

/api/profiles

/api/settings



Test:



CRUD

validation

database relationships

error handling



COMPLETION GATE:



Database and core APIs work without frontend dependency.



\---



\# 8. PHASE 2 — PROVIDER ABSTRACTION



Create a provider interface.



Supported operations where appropriate:



health

models

generate

stream

cancel



Provider implementations:



DemoProvider

OllamaProvider

ClaudeProvider



DemoProvider:



\- deterministic

\- clearly labeled DEMO

\- never presented as real AI



Ollama:



\- connection detection

\- model listing

\- model availability

\- generation

\- streaming

\- cancellation where practical

\- timeout handling

\- error handling



Ollama URL configurable.



Agents select:



provider

model



The Agent subsystem must not contain provider-specific logic.



Test provider adapters using mocks.



Do not require real Ollama for automated tests.



Create:



docs/providers.md

docs/ollama.md



COMPLETION GATE:



A configurable agent can execute against DemoProvider and OllamaProvider.



\---



\# 9. PHASE 3 — PROJECT WORKSPACE



Every project receives an isolated workspace.



Structure:



workspace/<project-id>/



Implement:



file tree

read

create

write

rename

delete

search



Security:



prevent ../ traversal.



Prevent absolute-path escape.



Protect against cross-project access.



Handle symlinks safely.



Implement agent permissions:



READ

WRITE

EXECUTE

DELETE



Permissions can be scoped to paths.



Example:



Planner:



plan.md WRITE

src READ



Researcher:



research.md WRITE

src READ



Implementer:



src READ/WRITE



Reviewer:



src READ



Tester:



tests READ/WRITE



Record file activity:



agent

project

path

operation

timestamp



Implement artifacts.



Implement artifact versions.



Create:



docs/workspaces.md

docs/file-security.md



COMPLETION GATE:



No agent can escape its assigned project workspace.



\---



\# 10. PHASE 4 — AGENTS, ROLES, MEMORY AND CONTEXT



Agents must be configurable.



Agent fields include:



name

role

description

system\_prompt

provider

model

profile

workspace

permissions

tools

status

enabled



Agent statuses:



OFFLINE

READY

WORKING

WAITING

PAUSED

COMPLETE

FAILED

AUTH\_REQUIRED

LIMIT\_REACHED



Do not invent provider status.



Implement custom roles.



Implement agent cloning.



Cloning must NOT duplicate credentials.



Implement project-scoped agent memory.



Memory must be:



persistent

editable

inspectable

project-scoped



Do not automatically send all memory to every agent.



Create a structured Context object.



Context can contain:



task

project

selected files

artifacts

previous outputs

memory

instructions



Create Context Inspector.



It should show what was included without exposing secrets.



Implement:



EDITING



Store pending prompt/context.



Allow user to modify it.



Then execute.



COMPLETION GATE:



Agent configuration, memory, context and execution work independently.



\---



\# 11. PHASE 5 — DAG WORKFLOW ENGINE



Build a real DAG workflow engine.



Do NOT use a simple sequential list.



Workflow contains:



nodes

edges

variables

settings



Node types:



START

AGENT

CONDITION

PARALLEL

HUMAN\_APPROVAL

END



Dependencies determine execution order.



Example:



Planner

&#x20;  |

&#x20;  +------ Researcher A

&#x20;  |

&#x20;  +------ Researcher B

&#x20;  |

&#x20;  +------ Researcher C

&#x20;  |

&#x20;  v

Implementer

&#x20;  |

Reviewer

&#x20;  |

Approval

&#x20;  |

Tester



Researchers A/B/C must be able to execute concurrently.



Use async execution.



Respect provider concurrency.



When multiple branches converge:



1\. wait for required branches

2\. collect outputs

3\. collect artifacts

4\. build aggregate context

5\. pass aggregate context downstream



Implement conditions.



Example:



review.severity == critical



Critical:



Implementer



Normal:



Tester



Do NOT execute arbitrary user Python/code.



Use safe expression evaluation.



Human Approval state:



WAITING\_FOR\_APPROVAL



Persist state.



Support:



Approve

Reject

Edit



Workflow state must survive backend restart.



Implement:



Start

Pause

Resume

Cancel

Retry

Run From Here



Implement node-level failure.



Support:



Retry

Skip

Stop

Change provider

Run from node



Persist workflow history.



Variables:



{{project\_name}}

{{task}}

{{plan}}

{{research}}

{{previous\_output}}



Use safe variable substitution.



Test:



simple DAG

parallel DAG

conditions

aggregation

approval

pause

resume

cancel

retry

run-from-node

restart recovery

variables



Create:



docs/orchestration.md

docs/workflows.md



COMPLETION GATE:



A complete multi-agent workflow can execute with parallel branches and

human approval.



\---



\# 12. PHASE 6 — VISUAL WORKFLOW BUILDER



Use React Flow or equivalent.



Support:



drag nodes

connect nodes

move nodes

delete nodes

zoom

pan

fit view



Nodes:



START

AGENT

CONDITION

PARALLEL

HUMAN APPROVAL

END



Node inspector.



Agent configuration:



agent

prompt

variables

timeout

retry policy



Condition:



expression

true branch

false branch



Approval:



message

approval options



Persist:



nodes

edges

positions

configuration



Validate before execution:



no cycles

valid start

valid end

valid dependencies

valid agents

valid conditions



Workflow operations:



create

edit

clone

delete

rename

run



Templates:



Software Development

Research

Debugging

Code Review

Documentation



Allow custom templates.



COMPLETION GATE:



A workflow can be created visually, saved, reopened and executed.



\---



\# 13. PHASE 7 — IDE WORKSPACE UI



Replace simple dashboard architecture with a real IDE-like shell.



Five regions:



1\. Top Bar

2\. Left Sidebar

3\. Center Workspace

4\. Right Inspector

5\. Bottom Event Timeline



All major panels should be:



resizable

collapsible

persistent



TOP BAR:



project selector

workflow state

provider status

system status

global search

settings



LEFT SIDEBAR:



Projects

Agents

Workflows

Files



CENTER:



Tabbed workspace.



Tabs:



Overview

Agent Chat

Team Chat

Workflow

Files

Activity

Logs



Tabs support:



open

close

reorder



RIGHT INSPECTOR:



Context-sensitive.



Agent:



name

role

provider

model

profile

status

task

permissions



Workflow node:



type

agent

prompt

dependencies

status



File:



path

modified by

permissions

versions



Run:



workflow

node

agent

provider

model

elapsed

artifacts

errors



BOTTOM:



Live event timeline.



Filters:



ALL

SYSTEM

AGENTS

WORKFLOW

FILES

ERRORS



COMMAND PALETTE:



Ctrl+K



Commands:



New Project

New Agent

New Workflow

Open Agent

Search

Run Workflow

Open Settings



Themes:



System

Light

Dark



Keyboard:



Ctrl+K

Ctrl+N

Ctrl+Shift+A

Ctrl+Shift+W

Ctrl+Enter

Escape



Test:



1280x720

1920x1080

2560x1440



COMPLETION GATE:



The application should feel like an IDE rather than a static dashboard.



\---



\# 14. PHASE 8 — CHAT AND AGENT COLLABORATION



Implement individual agent chat.



Features:



messages

streaming

stop

retry

regenerate

copy

history

file references



Show:



agent

provider

model

status



Implement Team Chat.



Mentions:



@Planner

@Researcher

@Implementer

@Reviewer

@Tester



@all broadcasts.



Example:



@Researcher investigate authentication architecture.



Only Researcher receives direct task.



@all sends to all enabled agents.



Persist:



sender

receiver

project

workflow

message

timestamp



Allow references to:



files

artifacts

workflow runs

agents



Notifications:



agent completed

agent failed

approval required

authentication required

provider unavailable



COMPLETION GATE:



Agents can communicate individually and through team chat.



\---



\# 15. PHASE 9 — EVENTS, NOTIFICATIONS AND OBSERVABILITY



Create an event bus.



Events:



PROJECT\_CREATED

AGENT\_STARTED

AGENT\_COMPLETED

AGENT\_FAILED

FILE\_CREATED

FILE\_MODIFIED

WORKFLOW\_STARTED

WORKFLOW\_PAUSED

WORKFLOW\_COMPLETED

APPROVAL\_REQUIRED

PROVIDER\_ERROR

AUTH\_REQUIRED



Persist events.



Timeline supports:



filter

search

sort

project filter

agent filter

workflow filter

error filter

time range



Run Inspector:



workflow

node

agent

provider

model

elapsed time

files

artifacts

events

errors



Workflow history:



list runs

inspect run



Artifact history:



versions

comparison where practical



Notification center:



unread/read



Global search:



projects

agents

messages

files

artifacts

workflows

events



Diagnostics:



backend

database

Ollama

Claude

active workflows

active agents



Never expose secrets.



COMPLETION GATE:



Actual system operations produce visible and persistent observability data.



\---



\# 16. PHASE 10 — CLAUDE PROVIDER AND PROFILES



Implement Claude integration only through legitimate supported mechanisms.



SECURITY:



Never:



cookie scraping

session extraction

token theft

login bypass

CAPTCHA bypass

automated account creation

rate-limit bypass

usage-limit bypass



Claude Provider must fit the common provider interface.



If legitimate Anthropic API credentials are configured:



support the official API.



Credentials remain backend-side.



Never return them to frontend.



Claude Profiles represent isolated configurations.



Possible fields:



id

name

provider

status

metadata

created\_at

updated\_at



Statuses:



NOT\_CONFIGURED

AUTH\_REQUIRED

AUTHENTICATED

SESSION\_EXPIRED

ERROR

DISABLED

UNAVAILABLE



Never claim AUTHENTICATED without real verification.



Example mapping:



Planner → Profile 1

Researcher → Profile 2

Implementer → Profile 3

Reviewer → Profile 4

Tester → Profile 5



This mapping is logical.



It must NOT imply automatic Claude Free account switching.



If Claude web/free accounts do not have an official supported mechanism for

this application:



display:



MANUAL AUTHENTICATION REQUIRED



and:



AUTOMATED MULTI-ACCOUNT WEB OPERATION NOT SUPPORTED



Do not reverse engineer unofficial methods.



Diagnostics:



profile

provider

status

last connection

last error

assigned agent



Never show:



API keys

cookies

session tokens



Fallback:



Claude unavailable

→ Ollama



Fallback configurable per agent.



Create:



docs/claude.md

docs/claude-limitations.md



COMPLETION GATE:



Claude integration is honest, secure and provider-independent.



\---



\# 17. PHASE 11 — TEAM TEMPLATES AND ROUTING



Built-in teams.



SOFTWARE DEVELOPMENT:



Planner

Researcher

Implementer

Reviewer

Tester



RESEARCH:



Research Planner

Technical Researcher

Security Researcher

Fact Checker

Writer



DEBUGGING:



Error Analyzer

Root Cause Analyst

Implementer

Tester

Reviewer



DOCUMENTATION:



Researcher

Writer

Editor

Reviewer



CUSTOM TEAM:



User creates own team.



Routing examples:



Planner → Claude

Researcher → Claude

Implementer → Claude

Tester → Ollama



Or:



Complex → Claude

Simple → Ollama



Fallback:



Claude unavailable

→ Ollama



Routing must be configurable.



Agent clone:



clone configuration

do not clone credentials



COMPLETION GATE:



A complete team can be provisioned from a template and customized.



\---



\# 18. PHASE 12 — SECURITY HARDENING



Perform a complete security audit.



FILE SECURITY:



path traversal

absolute paths

symlink handling

cross-project access



COMMAND EXECUTION:



If command execution exists:



validate commands

prevent injection

restrict execution

respect permissions



API:



validation

authorization boundaries

input sanitization

CORS

request limits

file limits

error handling



SECRETS:



Search repository for:



API keys

tokens

passwords

credentials



Verify no secrets appear in:



frontend bundle

logs

API responses

git



CLAUDE:



verify no:



cookie scraping

session theft

login bypass

CAPTCHA bypass

account automation

usage-limit bypass



PROJECT ISOLATION:



Project A must never access Project B.



ERRORS:



Do not expose raw stack traces to normal users.



LOGGING:



Useful but secret-free.



DEPENDENCIES:



Audit unnecessary dependencies.



Create:



docs/security.md



COMPLETION GATE:



Security tests pass.



\---



\# 19. PHASE 13 — COMPLETE TESTING



Do not introduce major features.



Backend:



unit

integration

API

database

workflow

provider

workspace security



Frontend:



component

integration

TypeScript

production build



End-to-end workflow:



Planner

↓

Researcher A

Researcher B

↓

Implementer

↓

Reviewer

↓

Human Approval

↓

Tester



Test:



parallel execution

provider failure

agent failure

workflow failure

retry

pause

resume

cancel



Restart backend during:



workflow

approval

agent execution



Verify recovery.



Performance:



large file trees

large event history

many agents

parallel workflows

long conversations



Windows compatibility.



COMPLETION GATE:



No critical test failures.



\---



\# 20. PHASE 14 — FINAL POLISH AND RELEASE



Do not redesign architecture.



Focus on:



reliability

UX

accessibility

polish

documentation



Remove:



dead buttons

placeholder controls

broken links

console errors

layout issues



Implement proper:



loading states

empty states

error states

success states



Long-running operations display progress.



Destructive operations require confirmation.



Keyboard navigation.



Focus management.



ARIA labels.



Readable contrast.



Verify:



1280x720

1920x1080

2560x1440



Finalize:



README.md



docs/

architecture.md

development.md

agents.md

providers.md

ollama.md

workspaces.md

workflows.md

orchestration.md

claude.md

claude-limitations.md

security.md

troubleshooting.md

testing.md



Documentation must reflect the actual implementation.



Final Windows instructions.



Final end-to-end test.



\---



\# 21. DEFAULT AGENT TEAM



After the platform is working, provide a default Software Development team.



PLANNER



Purpose:



Analyze user request.



Responsibilities:



\- understand requirements

\- identify constraints

\- create architecture

\- break task into subtasks

\- create plan.md



Default output:



plan.md



\---



RESEARCHER



Purpose:



Research technical requirements.



Responsibilities:



\- investigate libraries

\- investigate APIs

\- investigate technical approaches

\- identify risks

\- provide sources when web research is available



Default output:



research.md



\---



IMPLEMENTER



Purpose:



Implement the planned solution.



Responsibilities:



\- modify source code

\- create files

\- follow project architecture

\- run appropriate checks



\---



REVIEWER



Purpose:



Review implementation.



Responsibilities:



\- identify bugs

\- identify architecture problems

\- identify security issues

\- review code quality

\- produce review report



\---



TESTER



Purpose:



Validate the implementation.



Responsibilities:



\- run tests

\- identify failures

\- reproduce problems

\- verify requirements

\- create test report



\---



\# 22. DEFAULT SOFTWARE DEVELOPMENT WORKFLOW



Default workflow:



START

&#x20;|

&#x20;v

PLANNER

&#x20;|

&#x20;+----------------+

&#x20;|                |

&#x20;v                v

RESEARCHER A   RESEARCHER B

&#x20;|                |

&#x20;+-------+--------+

&#x20;        |

&#x20;        v

&#x20;   IMPLEMENTER

&#x20;        |

&#x20;        v

&#x20;     REVIEWER

&#x20;        |

&#x20;        v

&#x20;HUMAN APPROVAL

&#x20;        |

&#x20;        v

&#x20;      TESTER

&#x20;        |

&#x20;        v

&#x20;       END



Researcher A and B execute in parallel.



Implementer receives merged research.



Reviewer receives implementation artifacts.



Human Approval pauses execution.



Tester runs only after approval.



\---



\# 23. WORKFLOW STATE MACHINE



Workflow:



PENDING

RUNNING

PAUSED

WAITING\_FOR\_APPROVAL

COMPLETED

FAILED

CANCELLED



Node:



PENDING

READY

RUNNING

EDITING

WAITING

WAITING\_FOR\_APPROVAL

COMPLETED

FAILED

SKIPPED

CANCELLED



Persist every important transition.



\---



\# 24. PROVIDER ROUTING MODEL



Provider abstraction:



Agent

&#x20; ↓

Provider Router

&#x20; ↓

Provider

&#x20; ↓

Model

&#x20; ↓

Response



Possible:



Agent → Ollama → deepseek-r1:8b



Agent → Claude API → configured model



Agent → Demo → deterministic output



Never make the workflow engine provider-specific.



\---



\# 25. IMPORTANT CLAUDE PROFILE MODEL



ClaudeProfile is an abstraction.



Example:



Profile 1

Name: Planner Claude

Provider: Claude

Status: AUTH\_REQUIRED



Profile 2

Name: Research Claude

Provider: Claude

Status: AUTH\_REQUIRED



Profile 3

Name: Implementer Claude

Provider: Claude

Status: AUTH\_REQUIRED



Profile 4

Name: Reviewer Claude

Provider: Claude

Status: AUTH\_REQUIRED



Profile 5

Name: Tester Claude

Provider: Claude

Status: AUTH\_REQUIRED



These profiles can later point to legitimate supported provider

configurations.



Do NOT automatically claim that they represent five simultaneously

authenticated Claude Free web sessions.



\---



\# 26. UI DESIGN REQUIREMENTS



The UI should feel:



professional

fast

dense but readable

developer-oriented

modern

dark-mode friendly



Avoid:



huge cards

excessive empty space

unnecessary animations

dashboard-style marketing UI

fake metrics



Prefer:



panels

tabs

inspectors

trees

tables

timelines

badges

context menus

command palette

keyboard shortcuts



\---



\# 27. ERROR HANDLING



Every subsystem must have useful error states.



Provider:



Unavailable

Timeout

Authentication Required

Rate Limited

Model Missing

Generation Failed



Agent:



Failed

Paused

Waiting

Permission Denied



Workflow:



Invalid Graph

Dependency Failed

Approval Required

Execution Failed



Workspace:



Permission Denied

File Missing

Path Invalid

Cross-Project Access Denied



Frontend must never silently fail.



\---



\# 28. NO FAKE DATA RULE



Demo data may exist ONLY when explicitly marked as Demo.



Never fabricate:



provider usage

Claude authentication

token counts

API limits

model availability

execution results

agent status



If data is unavailable display:



Unavailable



or:



Not supported



\---



\# 29. DEVELOPMENT METHOD



IMPORTANT:



Implement this MASTER\_PLAN sequentially.



DO NOT attempt all phases at once.



At the beginning of each phase:



1\. inspect current repository

2\. inspect previous implementation

3\. identify existing reusable components

4\. identify tests

5\. identify risks

6\. implement only the current phase



Never delete working functionality without justification.



After each phase:



1\. run tests

2\. run type checking

3\. run linting where configured

4\. run production build

5\. start application where appropriate

6\. verify actual behavior

7\. fix errors

8\. update documentation

9\. update phase status



Then STOP.



Do not automatically begin the next phase.



\---



\# 30. PHASE STATUS TRACKER



Maintain:



docs/phase-status.md



Format:



Phase 0 — FOUNDATION

Status: COMPLETE / IN PROGRESS / BLOCKED



Implemented:

...



Tests:

...



Build:

...



Known Issues:

...



Files Changed:

...



Verification:

...



\---



Repeat for every phase.



Never mark a phase COMPLETE if important verification fails.



\---



\# 31. OPEN CODE OPERATING INSTRUCTIONS



You are the implementation agent.



MASTER\_PLAN.md is the source of truth for product architecture.



When asked to implement a phase:



1\. Read MASTER\_PLAN.md.

2\. Read existing architecture.

3\. Inspect existing code.

4\. Identify what already exists.

5\. Implement the requested phase.

6\. Do not duplicate existing functionality.

7\. Do not silently change architectural requirements.

8\. Ask for clarification only when requirements are genuinely contradictory.

9\. Otherwise make the simplest reasonable engineering decision.

10\. Test your work.

11\. Fix failures.

12\. Update documentation.

13\. Update docs/phase-status.md.

14\. Report exactly what changed.

15\. STOP.



Do not claim something works without testing it.



Do not claim authentication without verification.



Do not fabricate external provider functionality.



\---



\# 32. PHASE COMPLETION REPORT



At the end of every phase, output:



PHASE:

<phase number>



STATUS:

COMPLETE / INCOMPLETE / BLOCKED



IMPLEMENTED:

\- ...



FILES CREATED:

\- ...



FILES MODIFIED:

\- ...



DATABASE CHANGES:

\- ...



API CHANGES:

\- ...



FRONTEND CHANGES:

\- ...



TESTS:

\- ...



TYPECHECK:

PASS / FAIL



BUILD:

PASS / FAIL



SECURITY:

PASS / FAIL / NOT APPLICABLE



KNOWN ISSUES:

\- ...



MANUAL VERIFICATION:

\- ...



NEXT PHASE:

<phase number>



STOP AFTER THIS REPORT.



\---



\# 33. FINAL ACCEPTANCE CHECKLIST



Projects

\[ ]



Custom agents

\[ ]



Custom roles

\[ ]



Agent cloning

\[ ]



Demo provider

\[ ]



Ollama

\[ ]



Claude provider abstraction

\[ ]



Claude profiles

\[ ]



Workspace

\[ ]



File Explorer

\[ ]



File permissions

\[ ]



Artifacts

\[ ]



Artifact versions

\[ ]



Agent memory

\[ ]



Individual chat

\[ ]



Team chat

\[ ]



@mentions

\[ ]



@all

\[ ]



Agent-to-agent communication

\[ ]



DAG workflows

\[ ]



Parallel execution

\[ ]



Conditions

\[ ]



Human approval

\[ ]



Pause/resume

\[ ]



Retry

\[ ]



Cancel

\[ ]



Run from node

\[ ]



Workflow variables

\[ ]



Context inspector

\[ ]



Edit before run

\[ ]



Workflow history

\[ ]



Event timeline

\[ ]



Notifications

\[ ]



Global search

\[ ]



Command palette

\[ ]



IDE dashboard

\[ ]



Resizable panels

\[ ]



Tabs

\[ ]



Settings

\[ ]



Provider diagnostics

\[ ]



Security controls

\[ ]



Testing

\[ ]



Documentation

\[ ]



Windows compatibility

\[ ]



\---



\# 34. FINAL PRODUCT PRINCIPLE



The finished application must NOT merely be:



"five chat windows for five AI agents."



It should be a real:



LOCAL MULTI-AGENT AI WORKSPACE



where:



Projects

&#x20;   ↓

Agents

&#x20;   ↓

Providers

&#x20;   ↓

Memory

&#x20;   ↓

Files

&#x20;   ↓

Artifacts

&#x20;   ↓

Workflows

&#x20;   ↓

Execution

&#x20;   ↓

Review

&#x20;   ↓

Human Approval

&#x20;   ↓

Testing

&#x20;   ↓

Results



are all integrated into one coherent system.



The user should be able to open the application and manage an entire

AI engineering/research team from one interface.



\---



\# END OF MASTER PLAN

