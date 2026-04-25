# Agent Editor Node Reference

This document provides a comprehensive reference for all nodes available in the Agent Editor. Each node is documented with its inputs, outputs, settings, and data types.

---

## Type System

### Port Types
| Type | Description |
|------|-------------|
| `text` | String values |
| `number` | Numeric values (integers, floats) |
| `boolean` | True/false values |
| `object` | JSON objects |
| `array` | Arrays/lists |
| `any` | Any data type (wildcard) |

### Node Categories
- **ai**: Artificial Intelligence nodes (LLM, Planner, Skills)
- **memory**: Memory storage and retrieval
- **logic**: Flow control and data transformation
- **chat**: Chat integration nodes
- **utilities**: General utility nodes

---

## AI Nodes

### LLM Node (`llm`)

Sends a prompt to Google Gemini. Supports history, tools, and thinking.

**Category:** ai

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | Yes | Main input for the model |
| `prompt` | `text` | No | System prompt override |
| `context` | `any` | No | Additional data or documents |
| `tools` | `array` | No | Available functions/tools |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `text` | Model's text response |
| `thinking` | `text` | Internal model reasoning (if enabled) |
| `tool_calls` | `array` | Array of function calls made |
| `error` | `text` | Error message if failed |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `model` | select | gemini-2.0-flash-exp | Model selection |
| `apiKeyIndex` | select | - | API key from settings |
| `systemPrompt` | textarea | "Ты профессиональный ИИ-агент." | System instructions |
| `includeThoughts` | checkbox | true | Request thinking stream |
| `temperature` | number | 0.7 | Creativity level (0-1) |
| `useHistoryStore` | checkbox | false | Use database for history |
| `historyStoreId` | text | main | Database ID |

---

### Planner Node (`planner`)

Breaks down a task into subtasks. Outputs a structured plan.

**Category:** ai

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `text` | Yes | Task to plan |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `plan` | `object` | Full plan as JSON |
| `step1` | `text` | First step |
| `step2` | `text` | Second step |
| `step3` | `text` | Third step |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `model` | select | gemini-2.0-flash-exp | Model selection |
| `apiKeyIndex` | select | - | API key selection |
| `plannerPrompt` | textarea | "Разбей задачу на 3 логических этапа..." | Planning instructions |

---

### Skill Node (`skill`)

Executes a skill (plugin) from the registry.

**Category:** ai

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | Yes | Input data for skill |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `any` | Skill execution result |
| `error` | `text` | Error message if failed |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `skillId` | select | - | Skill identifier |
| `parameters` | json | {} | Additional parameters |

---

### Sub-Agent Node (`subagent`)

Runs another agent within the current agent.

**Category:** ai

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | Yes | Input for sub-agent |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `any` | Sub-agent result |
| `error` | `text` | Sub-agent error |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `agentId` | select | - | Agent graph ID |

---

## Memory Nodes

### Memory Read Node (`memory_read`)

Retrieves records from persistent agent memory.

**Category:** memory

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `text` | Yes | Search query or key |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `results` | `array` | Array of found records |
| `context_text` | `text` | Found data as text |
| `output` | `any` | Legacy output |
| `count` | `number` | Number of results |
| `found` | `boolean` | Whether data was found |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `readMode` | select | semantic_search | Search mode |
| `scope` | select | local | local or global |
| `limit` | number | 5 | Max results |

---

### Memory Write Node (`memory_write`)

Saves data to persistent memory.

**Category:** memory

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `text` | Yes | Storage key |
| `value` | `any` | Yes | Data to save |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `success` | `boolean` | Whether save succeeded |
| `output` | `any` | Saved data |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `writeMode` | select | direct_save | Save mode |
| `scope` | select | local | local or global |
| `ttl` | number | 0 | Time to live (0=forever) |

---

### Global DB Node (`global_db`)

Custom Key-Value database for storing any information.

**Category:** memory

**Inputs:** None

**Outputs:** None

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `storeId` | text | my_db | Database identifier |

---

## Logic Nodes

### Condition Node (`condition`)

Routes data based on a JavaScript condition expression.

**Category:** logic

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | Yes | Data to evaluate |
| `condition` | `text` | No | Override JS condition |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `condition_true` | `any` | Output when true |
| `condition_false` | `any` | Output when false |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `conditionCode` | textarea | input !== null && input !== undefined | JS expression |

---

### Router Node (`router`)

Splits incoming request into multiple paths based on conditions.

**Category:** logic

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | Yes | Data to route |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `route_a` | `any` | Route A output |
| `route_b` | `any` | Route B output |
| `route_c` | `any` | Route C output |
| `default` | `any` | Default output |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `routerMode` | select | if_else | Routing mode |
| `routeACondition` | text | - | Route A condition |
| `routeBCondition` | text | - | Route B condition |
| `routeCCondition` | text | - | Route C condition |

**Router Modes:**
- `if_else`: If-else chain
- `regex_match`: Regex pattern matching
- `llm_classify`: LLM-based classification
- `js_expression`: JavaScript expression

---

### Loop Node (`loop`)

Iterates over elements.

**Category:** logic

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `array` | Yes | Array to iterate |
| `loop_body` | `any` | No | Result of processing |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `current_item` | `any` | Current element |
| `loop_done` | `array` | All results after loop |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `maxIterations` | number | 100 | Max iterations |
| `iterateOver` | select | array_items | Iteration mode |
| `agentId` | select | - | Sub-agent for body |

---

### Merge Node (`merge`)

Combines multiple data streams.

**Category:** logic

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input_a` | `any` | No | Stream 1 |
| `input_b` | `any` | No | Stream 2 |
| `input_c` | `any` | No | Stream 3 |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `any` | Merged result |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mergeMode` | select | merge_objects | Merge mode |
| `separator` | text | \n | Text separator |

**Merge Modes:**
- `concat_text`: Concatenate text
- `merge_objects`: Merge objects
- `array_collect`: Collect into array
- `first_non_null`: First non-null value

---

### Split Node (`split`)

Splits data into parts.

**Category:** logic

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | Yes | Data to split |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `array` | Array of split elements |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `splitMode` | select | by_newline | Split mode |
| `delimiter` | text | \n | Delimiter |

**Split Modes:**
- `by_newline`: Split by newline
- `by_comma`: Split by comma
- `by_regex`: Split by regex
- `json_array`: Parse as JSON array
- `fixed_chunks`: Fixed-size chunks

---

### Feedback Node (`feedback`)

Pauses execution until user provides feedback.

**Category:** logic

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | No | Data for evaluation |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `feedback_result` | `object` | { reaction, message, context } |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `promptText` | text | Оцените ответ ИИ | Prompt text |

---

### Inline Feedback Node (`inline_feedback`)

Pauses and requests evaluation of intermediate result.

**Category:** logic

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `content` | `any` | Yes | Data for user to evaluate |
| `question` | `text` | No | Custom question |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `feedback_result` | `object` | { reaction, comment, timestamp } |
| `approved` | `boolean` | True if "like" |
| `rejected` | `boolean` | True if "dislike" |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `promptText` | text | Оцените промежуточный результат | Question for user |
| `showContent` | checkbox | true | Show content in widget |
| `allowComment` | checkbox | true | Allow comment field |
| `commentPlaceholder` | text | Ваш комментарий... | Comment placeholder |
| `timeout` | number | 0 | Timeout in seconds (0=infinite) |

---

## Chat Nodes

### Chat Input Node (`chat_input`)

Gets input from chat.

**Category:** chat

**Inputs:** None

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `text` | User message |
| `metadata` | `object` | Message metadata |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `source` | select | active_chat | Input source |

**Sources:**
- `active_chat`: Current active chat
- `chat_id`: Specific chat ID
- `last_message`: Last message only
- `full_history`: Full chat history

---

### Chat Output Node (`chat_output`)

Sends a message to chat.

**Category:** chat

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `text` | Yes | Message to send |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `success` | `boolean` | Whether sent successfully |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `target` | select | active_chat | Target chat |
| `streamOutput` | checkbox | false | Stream output |

---

### Database Hub Node (`database_hub`)

Visual hub for storing and managing messages. Works globally without wires.

**Category:** chat

**Inputs:** None

**Outputs:** None

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `storeId` | text | main | Database identifier |

---

### User Message Input Node (`user_message_input`)

Entry point for agent chat. Receives user message from active thread.

**Category:** chat

**Inputs:** None

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `message` | `text` | User message text |
| `metadata` | `object` | { threadId, timestamp, messageId } |
| `attachments` | `array` | Attached files (future) |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `placeholder` | text | Введите сообщение... | Input placeholder |
| `allowAttachments` | checkbox | false | Allow file attachments |
| `locked` | checkbox | false | Hide in publish mode |

---

### Agent Response Output Node (`agent_response_output`)

Final output point. Sends result to chat as agent response.

**Category:** chat

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `any` | Yes | Final agent response |
| `metadata` | `object` | No | Additional data |

**Outputs:** None

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `renderMode` | select | markdown | Render format |
| `label` | text | Ответ | Label for steps |
| `streamOutput` | checkbox | true | Enable streaming |

**Render Modes:**
- `markdown`: Render as markdown
- `plain_text`: Plain text
- `code_block`: Code block

---

### Chat History Node (`chat_history`)

Reads message history from current thread and formats for LLM.

**Category:** chat

**Inputs:** None

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `history_text` | `text` | History as text |
| `history_json` | `array` | Array of { role, content } |
| `last_n_messages` | `array` | Last N messages |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `limit` | number | 10 | Number of messages (0=all) |
| `format` | select | text | Output format |
| `includeSteps` | checkbox | false | Include execution steps |
| `roleFormat` | select | user/assistant | Role format |

**Formats:**
- `text`: Plain text
- `json`: JSON array
- `gemini_parts`: Gemini parts format

---

## Utility Nodes

### Transform Node (`transform`)

Transforms data using various methods.

**Category:** utilities

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | Yes | Data to transform |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `any` | Transformed data |
| `error` | `text` | Error message |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `transformType` | select | js_expression | Transform type |
| `expression` | textarea | return input; | JS code |

**Transform Types:**
- `js_expression`: JavaScript expression
- `extract_field`: Extract field from object
- `format_string`: Format string
- `json_parse`: Parse JSON string
- `json_stringify`: Stringify to JSON

---

### Code Node (`code`)

Executes arbitrary JavaScript code.

**Category:** utilities

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | No | Input data |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `any` | Computation result |
| `error` | `text` | Error message |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `code` | textarea | // Your code here\nreturn input; | JavaScript code |

---

### HTTP Request Node (`http_request`)

Makes requests to external APIs.

**Category:** utilities

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `text` | Yes | Request URL |
| `body` | `object` | No | Request body |
| `headers` | `object` | No | HTTP headers |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `response` | `object` | Server response |
| `status` | `number` | Response status code |
| `error` | `text` | Error message |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `method` | select | GET | HTTP method |
| `authType` | select | none | Authentication type |

**Methods:** GET, POST, PUT, DELETE, PATCH

**Auth Types:**
- `none`: No authentication
- `bearer`: Bearer token
- `api_key`: API key
- `basic`: Basic auth

---

### Debug Node (`debug`)

Outputs data for debugging.

**Category:** utilities

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | Yes | Data to log |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `any` | Pass-through data |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `debugLabel` | text | Debug | Log label |
| `logLevel` | select | log | Log level |
| `showInRunPanel` | checkbox | true | Show in run panel |

**Log Levels:** log, warn, error

---

### Input Node (`agent_input`)

Agent input entry point.

**Category:** utilities

**Inputs:** None

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `any` | Data for next node |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `inputType` | select | static | Input source |
| `fieldLabel` | text | Your message | Field label |
| `placeholder` | text | - | Placeholder text |
| `initialValue` | textarea | - | Static value |

**Input Types:**
- `user_input`: Ask user
- `static`: Static value
- `chat_message`: Last chat message

---

### Output Node (`agent_output`)

Agent output endpoint.

**Category:** utilities

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | Yes | Final result |

**Outputs:** None

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `outputType` | select | display | Output type |
| `outputLabel` | text | Result | Output label |

**Output Types:**
- `display`: Display in RunPanel
- `json`: JSON format
- `text`: Plain text

---

### Text Node (`text`)

Static text value.

**Category:** utilities

**Inputs:** None

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `text` | Static text |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `content` | textarea | - | Text content |

---

### Template Node (`template`)

Text template with {{variable}} substitution.

**Category:** utilities

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `var1` | `any` | No | Variable 1 |
| `var2` | `any` | No | Variable 2 |
| `var3` | `any` | No | Variable 3 |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `text` | Assembled text |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `template` | textarea | Hello, {{var1}}! You said: {{var2}} | Template |

---

### Variable Node (`variable`)

Temporary variable for one execution run.

**Category:** utilities

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `set_value` | `any` | No | Set value |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `value` | `any` | Current value |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `varName` | text | myVar | Variable name |
| `initialValue` | textarea | - | Default value |

---

### JSON Extract Node (`json_extract`)

Extracts field from JSON using dot notation.

**Category:** utilities

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | Yes | JSON input |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `any` | Extracted value |
| `error` | `text` | Error if not found |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `path` | text | data.result | JSON path (dot notation) |
| `parseFirst` | checkbox | true | Parse JSON string first |

---

### Delay Node (`delay`)

Adds a delay to pass-through data.

**Category:** utilities

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `any` | Yes | Pass-through data |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `output` | `any` | Same data after delay |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `milliseconds` | number | 1000 | Delay in milliseconds |

---

### Context Injector Node (`context_injector`)

Combines multiple data sources into single context for LLM.

**Category:** utilities

**Inputs:**
| Port | Type | Required | Description |
|------|------|----------|-------------|
| `user_message` | `text` | No | Current user question |
| `chat_history` | `text` | No | Chat history |
| `memory_context` | `text` | No | Memory context |
| `additional_context` | `any` | No | Additional data |

**Outputs:**
| Port | Type | Description |
|------|------|-------------|
| `full_context` | `text` | Assembled context |
| `summary` | `text` | Brief summary |

**Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `template` | textarea | {{user_message}}\n\n---\nHistory:\n... | Assembly template |
| `includeTimestamp` | checkbox | false | Add timestamps |
| `separator` | text | \n---\n | Section separator |

---

## Node Compatibility Matrix

### Type Compatibility
Ports are compatible when:
- Source type is `any` (matches any target)
- Target type is `any` (accepts any source)
- Source and target types are identical

### Common Patterns

**LLM + Memory Read:**
```
memory_read.output (any) → llm.context (any)
```

**Router + Multiple LLM:**
```
llm.output (text) → router.input (any)
router.route_a → llm1.input
router.route_b → llm2.input
```

**Loop + Transform:**
```
array (array) → loop.items (array)
loop.current_item → transform.input
transform.output → loop.loop_body
```

---

## Execution Flow

1. **Entry Points**: Nodes without inputs (Chat Input, Text, Agent Input) start execution
2. **Data Flow**: Data flows from outputs to connected inputs
3. **Parallel Execution**: Independent branches execute in parallel
4. **Blocking Nodes**: Feedback, Inline Feedback, and Delay block execution
5. **Termination**: Agent Output or Chat Output nodes end execution

---

## Aliases

For backward compatibility:
- `agent_input` → `input`
- `agent_output` → `output`
- `memory` → `memory_read`