'use client';

import { useState, useEffect } from 'react';
import { X, RotateCcw, Download, Upload, Save } from 'lucide-react';
import type { Skill } from '@/lib/skills/types';
import { 
  getSkillCustomization, 
  saveSkillCustomization, 
  resetSkillCustomization,
  exportSkillsSettings,
  importSkillsSettings
} from '@/lib/skills/registry';

interface Props {
  skill: Skill;
  onClose: () => void;
  onSave: () => void;
}

export default function SkillCustomizationModal({ skill, onClose, onSave }: Props) {
  const [customDescription, setCustomDescription] = useState('');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [customToolDescriptions, setCustomToolDescriptions] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'description' | 'system' | 'tools'>('description');

  useEffect(() => {
    const customization = getSkillCustomization(skill.id);
    if (customization) {
      setCustomDescription(customization.customDescription || '');
      setCustomSystemPrompt(customization.customSystemPrompt || '');
      setCustomToolDescriptions(customization.customToolDescriptions || {});
    }
  }, [skill.id]);

  const handleSave = () => {
    saveSkillCustomization(skill.id, {
      customDescription: customDescription.trim() || undefined,
      customSystemPrompt: customSystemPrompt.trim() || undefined,
      customToolDescriptions: Object.keys(customToolDescriptions).length > 0 
        ? customToolDescriptions 
        : undefined,
    });
    onSave();
  };

  const handleReset = () => {
    if (confirm('Сбросить все настройки к значениям по умолчанию?')) {
      resetSkillCustomization(skill.id);
      setCustomDescription('');
      setCustomSystemPrompt('');
      setCustomToolDescriptions({});
      onSave();
    }
  };

  const handleExport = () => {
    const data = exportSkillsSettings();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skills-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = importSkillsSettings(data);
        alert(`Импортировано: ${result.success} скиллов\nОшибок: ${result.failed}`);
        onSave();
        onClose();
      } catch (err) {
        alert(`Ошибка импорта: ${err}`);
      }
    };
    input.click();
  };

  const updateToolDescription = (toolName: string, value: string) => {
    setCustomToolDescriptions(prev => ({
      ...prev,
      [toolName]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e1e1e] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{skill.icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-white">Настройки скилла</h2>
              <p className="text-sm text-gray-400">{skill.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Экспортировать все настройки"
            >
              <Download className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={handleImport}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Импортировать настройки"
            >
              <Upload className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Сбросить к умолчаниям"
            >
              <RotateCcw className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab('description')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              activeTab === 'description'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            Описание
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              activeTab === 'system'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            Системный промпт
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              activeTab === 'tools'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            Инструменты ({skill.tools.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'description' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Описание по умолчанию
                </label>
                <div className="p-3 bg-white/5 rounded-lg text-sm text-gray-400 border border-white/10">
                  {skill.description}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Кастомное описание
                  <span className="text-xs text-gray-500 ml-2">(оставьте пустым для использования дефолтного)</span>
                </label>
                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Введите своё описание скилла..."
                  className="w-full h-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Системный промпт по умолчанию
                </label>
                <div className="p-3 bg-white/5 rounded-lg text-sm text-gray-400 border border-white/10 max-h-48 overflow-y-auto">
                  {skill.onSystemPrompt ? (
                    <pre className="whitespace-pre-wrap font-mono text-xs">
                      {skill.onSystemPrompt.toString()}
                    </pre>
                  ) : (
                    <span className="text-gray-500 italic">Системный промпт не определён</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Кастомный системный промпт
                  <span className="text-xs text-gray-500 ml-2">(переопределяет onSystemPrompt)</span>
                </label>
                <textarea
                  value={customSystemPrompt}
                  onChange={(e) => setCustomSystemPrompt(e.target.value)}
                  placeholder="Введите свой системный промпт для этого скилла..."
                  className="w-full h-64 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Этот текст будет добавлен в системный промпт при каждом запросе к API
                </p>
              </div>
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="space-y-6">
              {skill.tools.map((tool) => (
                <div key={tool.name} className="border border-white/10 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-2">
                    {tool.name}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Описание по умолчанию
                      </label>
                      <div className="p-2 bg-white/5 rounded text-xs text-gray-400 max-h-32 overflow-y-auto">
                        {tool.description}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Кастомное описание
                      </label>
                      <textarea
                        value={customToolDescriptions[tool.name] || ''}
                        onChange={(e) => updateToolDescription(tool.name, e.target.value)}
                        placeholder="Оставьте пустым для использования дефолтного..."
                        className="w-full h-24 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
