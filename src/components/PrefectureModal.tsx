import React from 'react';
import { X, Check } from 'lucide-react';

interface PrefectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePrefsInRecords: Set<string>;
  selectedPrefs: Set<string>;
  onTogglePref: (pref: string) => void;
  onReset: () => void;
}

export const PrefectureModal: React.FC<PrefectureModalProps> = ({
  isOpen,
  onClose,
  activePrefsInRecords,
  selectedPrefs,
  onTogglePref,
  onReset,
}) => {
  if (!isOpen) return null;

  const renderChip = (pref: string, colSpan?: string) => {
    const isAvailable = activePrefsInRecords.has(pref);
    const isSelected = selectedPrefs.has(pref);

    return (
      <button
        key={pref}
        type="button"
        disabled={!isAvailable}
        onClick={() => onTogglePref(pref)}
        className={`px-2.5 py-1.5 text-xs rounded-xl border transition flex items-center justify-center gap-1.5 select-none ${colSpan || ''} ${
          isSelected
            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm shadow-blue-500/20'
            : isAvailable
            ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 font-medium'
            : 'bg-slate-100/60 text-slate-300 border-slate-200/60 opacity-40 cursor-not-allowed'
        }`}
      >
        <span
          className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${
            isSelected ? 'bg-white text-blue-600 border-white' : 'border-slate-300 bg-white'
          }`}
        >
          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
        </span>
        <span>{pref}</span>
      </button>
    );
  };

  return (
    <div
      id="pref-map-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#F8FAFC] w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="h-16 bg-white px-6 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">都道府県で絞り込み</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              地図から複数選択できます。記録が存在する都道府県のみ選択可能です。
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Japan Grid Layout */}
        <div className="p-4 sm:p-6 overflow-y-auto overflow-x-auto space-y-4">
          <div className="min-w-[680px] flex flex-col gap-4">
            {/* Top Row: Tohoku & Hokkaido */}
            <div className="flex justify-end gap-4 pr-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">北海道</div>
                <div className="grid grid-cols-1 gap-2">
                  {renderChip('北海道')}
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">東北</div>
                <div className="grid grid-cols-3 gap-2">
                  {['青森', '岩手', '宮城', '秋田', '山形', '福島'].map(p => renderChip(p))}
                </div>
              </div>
            </div>

            {/* Bottom Row: Kyushu -> Chugoku/Shikoku -> Kinki -> Chubu -> Kanto */}
            <div className="flex justify-start gap-3 items-start">
              {/* Kyushu */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">九州・沖縄</div>
                <div className="grid grid-cols-2 gap-2">
                  {['福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'].map(p => renderChip(p))}
                </div>
              </div>

              {/* Chugoku & Shikoku */}
              <div className="flex flex-col gap-3">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">中国</div>
                  <div className="grid grid-cols-2 gap-2">
                    {['鳥取', '島根', '岡山', '広島'].map(p => renderChip(p))}
                    {renderChip('山口', 'col-span-2')}
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">四国</div>
                  <div className="grid grid-cols-3 gap-2">
                    {['徳島', '香川', '愛媛'].map(p => renderChip(p))}
                    {renderChip('高知', 'col-span-3')}
                  </div>
                </div>
              </div>

              {/* Kinki */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">近畿</div>
                <div className="grid grid-cols-2 gap-2">
                  {['三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山'].map(p => renderChip(p))}
                </div>
              </div>

              {/* Chubu */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">中部</div>
                <div className="grid grid-cols-2 gap-2">
                  {['新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡'].map(p => renderChip(p))}
                  {renderChip('愛知', 'col-span-2')}
                </div>
              </div>

              {/* Kanto */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">関東</div>
                <div className="grid grid-cols-3 gap-2">
                  {['茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川'].map(p => renderChip(p))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-16 bg-white px-6 border-t border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={onReset}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200/80 transition"
          >
            すべて解除
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-500/20 transition"
          >
            選択を反映して閉じる ({selectedPrefs.size}件選択中)
          </button>
        </div>
      </div>
    </div>
  );
};
