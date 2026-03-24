import type { Skill, SkillContext, SkillToolResult, GeminiToolDeclaration } from '../types';
import { nanoid } from 'nanoid';

// ─────────────────────────────────────────────────────────────────────────────
// Website Builder Skill — создание и модификация сайтов в реальном времени
// ─────────────────────────────────────────────────────────────────────────────

const tools: GeminiToolDeclaration[] = [
  {
    name: 'set_website_meta',
    description: 'Set metadata for the website you are about to create. Call this BEFORE writing the HTML code. After calling this, immediately write the full HTML in a markdown code block.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Website title'
        },
        description: {
          type: 'string',
          description: 'Brief description of what the website does'
        },
        tech_stack: {
          type: 'string',
          enum: ['tailwind', 'bootstrap', 'custom_css'],
          description: 'CSS framework to use'
        },
        website_type: {
          type: 'string',
          enum: ['static', 'ai_interactive'],
          description: 'Type of website: "static" for regular editable website, "ai_interactive" for website with GeminiBridge (AI data exchange)'
        },
        features: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of key features to implement'
        }
      },
      required: ['title', 'description', 'tech_stack', 'website_type']
    }
  },
  {
    name: 'update_element',
    description: 'Update a specific element on the website. Use this when user clicks on an element or asks to modify something specific.',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector of element to update (e.g., "#hero-title", ".btn-primary")'
        },
        changes: {
          type: 'string',
          description: 'Description of what to change'
        },
        css_updates: {
          type: 'object',
          description: 'CSS properties to update',
          properties: {
            color: { type: 'string' },
            background: { type: 'string' },
            fontSize: { type: 'string' },
            padding: { type: 'string' },
            margin: { type: 'string' }
          }
        }
      },
      required: ['selector', 'changes']
    }
  },
  {
    name: 'apply_theme',
    description: 'Apply a visual theme to the website. After calling this, write the updated HTML with new theme styles.',
    parameters: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          enum: ['dark', 'light', 'blue', 'purple', 'green', 'orange', 'minimal', 'gradient', 'glassmorphism', 'neumorphism'],
          description: 'Theme to apply'
        },
        custom_colors: {
          type: 'object',
          description: 'Custom color palette (optional)',
          properties: {
            primary: { type: 'string' },
            secondary: { type: 'string' },
            background: { type: 'string' },
            text: { type: 'string' }
          }
        }
      },
      required: ['theme']
    }
  }
];

async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  ctx: SkillContext
): Promise<SkillToolResult> {
  
  switch (toolName) {
    case 'set_website_meta': {
      const { title, description, tech_stack, website_type, features } = args as { 
        title: string; 
        description: string; 
        tech_stack: string;
        website_type: 'static' | 'ai_interactive';
        features?: string[] 
      };
      
      // Store metadata
      ctx.storage.setJSON('website_meta', {
        title,
        description,
        tech_stack,
        website_type,
        features: features || [],
        created_at: Date.now()
      });
      
      const typeEmoji = website_type === 'ai_interactive' ? '🤖' : '🌐';
      const typeLabel = website_type === 'ai_interactive' ? 'AI-интерактивный' : 'Статический';
      
      ctx.emit({
        type: 'toast',
        message: `${typeEmoji} Создаю ${typeLabel} сайт: ${title}`,
        variant: 'success'
      });
      
      return {
        mode: 'respond',
        response: {
          success: true,
          website_type,
          message: 'Metadata set. Now write the complete HTML code in a markdown code block. The website will appear in live preview as you write.',
          instruction: 'Write full HTML with <!DOCTYPE html>, <head>, and <body>. Use semantic HTML5 tags and modern CSS.'
        }
      };
    }
    
    case 'update_element': {
      const { selector, changes, css_updates } = args as { 
        selector: string; 
        changes: string;
        css_updates?: Record<string, string>;
      };
      
      ctx.emit({
        type: 'toast',
        message: `🔄 Обновляю элемент: ${selector}`,
        variant: 'success'
      });
      
      return {
        mode: 'respond',
        response: {
          success: true,
          message: `Element ${selector} will be updated. Now write the updated HTML code in a markdown code block.`,
          changes,
          css_updates
        }
      };
    }
    
    case 'apply_theme': {
      const { theme, custom_colors } = args as {
        theme: string;
        custom_colors?: Record<string, string>;
      };
      
      ctx.storage.setJSON('current_theme', { theme, custom_colors });
      
      ctx.emit({
        type: 'toast',
        message: `🎨 Применяю тему: ${theme}`,
        variant: 'success'
      });
      
      return {
        mode: 'respond',
        response: {
          success: true,
          message: `Theme ${theme} will be applied. Now write the updated HTML with new theme styles in a markdown code block.`,
          theme,
          custom_colors
        }
      };
    }
    
    default:
      return {
        mode: 'respond',
        response: {
          success: false,
          error: `Unknown tool: ${toolName}`
        }
      };
  }
}

function getSystemPrompt(ctx: SkillContext): string | null {
  // Check for custom prompt override
  const { getSkillPrompt } = require('@/lib/storage');
  const customPrompt = getSkillPrompt('website_builder');
  
  if (customPrompt) {
    return customPrompt;
  }
  
  // Default prompt
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 LIVE WEBSITE BUILDER — Real-time HTML/CSS/JS Rendering
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have access to a Live Website Builder that renders HTML/CSS/JS in REAL-TIME as you write.

🔥 CRITICAL: How to create websites with live streaming effect:

1. FIRST: Call set_website_meta({ title, description, tech_stack, website_type, features })
2. IMMEDIATELY AFTER: Write the complete HTML in a markdown code block

The website will appear in live preview AS YOU WRITE each line of HTML!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 WEBSITE TYPES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST specify website_type in set_website_meta:

1. **"static"** — Regular website (landing pages, portfolios, blogs, documentation)
   - User can click elements to get info in chat
   - User can edit elements via chat
   - Use for: landing pages, portfolios, blogs, documentation, static content

2. **"ai_interactive"** — Interactive app that sends data to AI in chat
   - Website can send data to AI via window.GeminiBridge.send()
   - AI responds in chat (not back to website)
   - Use for: forms that need AI analysis, data collection tools, calculators, surveys
   
   EXAMPLE CODE for ai_interactive:
   \`\`\`javascript
   // Send data to AI when user submits form
   const submitBtn = document.getElementById('submitBtn');
   document.getElementById('myForm').addEventListener('submit', (e) => {
     e.preventDefault();
     
     // Disable button to prevent spam
     submitBtn.disabled = true;
     submitBtn.textContent = 'Отправлено...';
     
     const formData = {
       name: document.getElementById('name').value,
       email: document.getElementById('email').value,
       message: document.getElementById('message').value
     };
     
     // Send to AI for analysis
     window.GeminiBridge.send('form_submission', formData);
     
     // Show loading state
     window.GeminiBridge.setLoading(true);
     
     // Re-enable after 3 seconds (optional)
     setTimeout(() => {
       submitBtn.disabled = false;
       submitBtn.textContent = 'Отправить';
       window.GeminiBridge.setLoading(false);
     }, 3000);
   });
   
   // Optional: Listen for AI response (if needed)
   window.GeminiBridge.onResponse((type, payload) => {
     console.log('AI responded:', type, payload);
     submitBtn.disabled = false;
     submitBtn.textContent = 'Отправить';
     window.GeminiBridge.setLoading(false);
   });
   \`\`\`

EXAMPLES:
- "Create a landing page for coffee shop" → website_type: "static"
- "Build a portfolio website" → website_type: "static"
- "Make a form to collect user feedback and analyze it with AI" → website_type: "ai_interactive"
- "Create a calculator that sends results to AI for explanation" → website_type: "ai_interactive"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 AVAILABLE TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- set_website_meta: Set metadata BEFORE writing HTML (required first step)
- update_element: Update specific element when user clicks on it
- apply_theme: Apply theme, then write updated HTML

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ BEST PRACTICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Always call set_website_meta FIRST
2. Write HTML as TEXT in markdown code block (NOT as tool argument)
3. Use Tailwind CSS CDN for quick styling: <script src="https://cdn.tailwindcss.com"></script>
4. Make designs responsive and modern
5. Use semantic HTML5 tags
6. Add smooth transitions and animations

🔥 FOR AI_INTERACTIVE SITES — CRITICAL:
- ALWAYS disable submit button after sending data: \`button.disabled = true\`
- Change button text to show loading: \`button.textContent = 'Отправлено...'\`
- Re-enable after 3 seconds or when AI responds
- This prevents spam and improves UX

When user clicks on an element:
- You'll receive context: { type: 'click', tagName: 'BUTTON', id: 'submit-btn', className: '...' }
- Call update_element({ selector: '#submit-btn', changes: 'Make it blue' })
- Then write the updated HTML
`.trim();
}

export const websiteBuilderSkill: Skill = {
  id: 'website_builder',
  name: 'Website Builder',
  description: 'Create and modify websites in real-time with live preview',
  longDescription: 'Build complete websites with HTML/CSS/JS. See changes instantly in live preview. Drag elements from preview to chat. Apply themes, add components, and create responsive designs. Create AI-interactive apps with GeminiBridge.',
  version: '2.0.0',
  icon: '🌐',
  category: 'dev',
  author: 'Gemini Playground',
  tags: ['html', 'css', 'javascript', 'web', 'design', 'frontend', 'ai-interactive'],
  
  tools,
  
  onSystemPrompt: getSystemPrompt,
  
  onToolCall: handleToolCall,
  
  onInstall: (ctx) => {
    ctx.emit({
      type: 'toast',
      message: '🌐 Website Builder установлен! Попроси AI создать сайт.',
      variant: 'success'
    });
  },
  
  getPanelData: (ctx) => {
    const current = ctx.storage.getJSON<any>('current_website');
    if (!current) return null;
    
    return {
      title: 'Current Website',
      items: [
        { label: 'Description', value: current.description || 'N/A' },
        { label: 'Last Updated', value: new Date(current.updated_at).toLocaleString() },
        { label: 'Features', value: current.features?.join(', ') || 'None' },
        { label: 'Last Change', value: current.last_change || 'Initial creation' }
      ]
    };
  }
};
