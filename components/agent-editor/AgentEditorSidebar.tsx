import React, { useState } from 'react';
import { 
  Cpu, Brain, Wrench, GitBranch, LogIn, LogOut,
  Shuffle, Merge as MergeIcon, Split, Repeat,
  MessageSquare, Database, Code, Bug, Globe, Search,
  FileText, Braces, Timer, Clock, ChevronDown, Zap,
  HardDrive, ThumbsUp
} from 'lucide-react';
import { NODE_DEFINITIONS } from '@/lib/agent-engine/node-definitions';

const NODE_CATEGORIES = [
  {
    name: 'Основные',
    nodes: [
      { type: 'agent_input', label: 'Вход', icon: <LogIn size={14} />, description: 'Точка входа данных' },
      { type: 'agent_output', label: 'Выход', icon: <LogOut size={14} />, description: 'Финальный результат' },
    ]
  },
  {
    name: 'ИИ Модели',
    nodes: [
      { type: 'llm', label: 'Нейросеть (LLM)', icon: <Cpu size={14} />, description: 'Вызвать языковую модель' },
      { type: 'subagent', label: 'Саб-Агент', icon: <Cpu size={14} />, description: 'Запустить другого агента' },
    ]
  },
  {
    name: 'Данные',
    nodes: [
      { type: 'transform', label: 'Трансформация', icon: <Shuffle size={14} />, description: 'Преобразовать данные' },
      { type: 'merge', label: 'Объединение', icon: <MergeIcon size={14} />, description: 'Объединить входы' },
      { type: 'split', label: 'Разделение', icon: <Split size={14} />, description: 'Разделить данные' },
    ]
  },
  {
    name: 'Навыки',
    nodes: [
      { type: 'skill', label: 'Навык', icon: <Wrench size={14} />, description: 'Выполнить навык' },
    ]
  },
  {
    name: 'Память',
    nodes: [
      { type: 'memory_read', label: 'Чтение памяти', icon: <Database size={14} />, description: 'Читать из памяти' },
      { type: 'memory_write', label: 'Запись в память', icon: <Database size={14} />, description: 'Записать в память' },
      { type: 'global_db', label: 'Глобальная БД', icon: <HardDrive size={14} />, description: 'Key-Value хранилище' },
    ]
  },
  {
    name: 'Логика',
    nodes: [
      { type: 'condition', label: 'Условие', icon: <GitBranch size={14} />, description: 'If/else ветвление' },
      { type: 'router', label: 'Роутер', icon: <GitBranch size={14} />, description: 'Мульти-маршрутизация' },
      { type: 'loop', label: 'Цикл', icon: <Repeat size={14} />, description: 'Итерация по массиву' },
      { type: 'feedback', label: 'Обратная связь', icon: <ThumbsUp size={14} />, description: 'Лайк/дизлайк от пользователя' },
    ]
  },
  {
    name: 'Чат',
    nodes: [
      { type: 'chat_input', label: 'Чат Ввод', icon: <MessageSquare size={14} />, description: 'Получить сообщение' },
      { type: 'chat_output', label: 'Чат Вывод', icon: <MessageSquare size={14} />, description: 'Отправить в чат' },
      { type: 'database_hub', label: 'Database Hub', icon: <Database size={14} />, description: 'Хранилище истории чата' },
    ]
  },
  {
    name: 'Утилиты',
    nodes: [
      { type: 'text', label: 'Текст', icon: <FileText size={14} />, description: 'Статический текст' },
      { type: 'template', label: 'Шаблон', icon: <FileText size={14} />, description: 'Строковый шаблон' },
      { type: 'variable', label: 'Переменная', icon: <Braces size={14} />, description: 'Хранить значение' },
      { type: 'json_extract', label: 'JSON Extract', icon: <Search size={14} />, description: 'Извлечь по пути' },
      { type: 'code', label: 'Код', icon: <Code size={14} />, description: 'Кастомный JavaScript' },
      { type: 'debug', label: 'Дебаг', icon: <Bug size={14} />, description: 'Отладочный вывод' },
      { type: 'http_request', label: 'HTTP Запрос', icon: <Globe size={14} />, description: 'HTTP вызов' },
      { type: 'delay', label: 'Задержка', icon: <Timer size={14} />, description: 'Ждать N мс' },
    ]
  },
];

export const AgentEditorSidebar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(NODE_CATEGORIES.map(c => c.name))
  );

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const filteredCategories = NODE_CATEGORIES.map(category => ({
    ...category,
    nodes: category.nodes.filter(node =>
      node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.nodes.length > 0);

  return (
    <div className="w-[240px] bg-[var(--surface-1)] border-r border-[var(--border)] flex flex-col h-full z-20 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/50">
        <h3 className="text-xs font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2 uppercase tracking-widest">
          <Zap size={14} className="text-[var(--text-muted)] fill-white/10" />
          Nodes Library
        </h3>
        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] group-focus-within:text-white transition-colors" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--surface-3)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-white/20 focus:border-white/50 transition-all placeholder:text-[var(--text-dim)]/50 font-medium"
          />
        </div>
      </div>
      
      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {filteredCategories.map((category) => (
          <div key={category.name} className="mb-2">
            <button
              onClick={() => toggleCategory(category.name)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--surface-3)]/50 transition-colors group"
            >
              <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider group-hover:text-[var(--text-primary)] transition-colors">
                {category.name}
              </span>
              <ChevronDown
                size={14}
                className={`text-[var(--text-dim)] transition-transform duration-200 ${expandedCategories.has(category.name) ? '' : '-rotate-90'}`}
              />
            </button>
            
            {expandedCategories.has(category.name) && (
              <div className="mt-1 flex flex-col gap-1 px-1">
                {category.nodes.map((node) => (
                  <div
                    key={node.type}
                    onDragStart={(e) => onDragStart(e, node.type, node.label)}
                    draggable
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent bg-[var(--surface-2)]/40 cursor-grab active:cursor-grabbing hover:bg-[var(--surface-3)] hover:border-white/20 hover:shadow-lg transition-all group overflow-hidden"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 group-hover:border-white/30 transition-colors">
                      <span className="text-[var(--text-dim)] group-hover:text-white transition-colors">{node.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                        {node.label}
                      </div>
                      <div className="text-[9px] text-[var(--text-dim)] truncate opacity-70">
                        {node.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
