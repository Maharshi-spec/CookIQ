
import React, { useState } from 'react';
import { RecipeSet, Recipe } from '../types';

interface RecipeDisplayProps {
  recipeSet: RecipeSet;
  onReset: () => void;
}

export const RecipeDisplay: React.FC<RecipeDisplayProps> = ({ recipeSet, onReset }) => {
  const [activeRecipeIndex, setActiveRecipeIndex] = useState(0);
  const { analysis, recipes, sources } = recipeSet;
  const { categorization, safetyAlerts } = analysis;
  const currentRecipe = recipes[activeRecipeIndex];

  if (!currentRecipe) return null;

  const nutritionItems = [
    { label: 'Calories', value: currentRecipe.nutrition.calories, icon: '🔥' },
    { label: 'Protein', value: currentRecipe.nutrition.protein, icon: '🍗' },
    { label: 'Carbs', value: currentRecipe.nutrition.carbs, icon: '🍞' },
    { label: 'Fats', value: currentRecipe.nutrition.fats, icon: '🥑' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
      
      {/* Global Safety & Integrity Report */}
      <section className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-6 opacity-5">
           <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM11 11H9V13H11V15H13V13H15V11H13V9H11V11Z"/></svg>
        </div>
        
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
           <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
           Ingredient Intelligence Scan
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
             <div>
               <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Accepted Edibles</span>
               <div className="flex flex-wrap gap-2">
                  {categorization.edible.map((ed, i) => (
                    <span key={i} className="text-xs font-bold text-gray-700 bg-emerald-50 px-2 py-1 rounded-md">{ed}</span>
                  ))}
               </div>
             </div>
             {categorization.nonFood && categorization.nonFood.length > 0 && (
               <div>
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Non-Food Filtered</span>
                 <p className="text-xs text-gray-300 font-medium line-through italic">{categorization.nonFood.join(', ')}</p>
               </div>
             )}
          </div>

          <div className="space-y-4">
             {categorization.toxic && categorization.toxic.length > 0 && (
               <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                  <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-1">Toxic Alert</span>
                  <p className="text-xs text-red-700 font-bold italic">{categorization.toxic.join(', ')}</p>
               </div>
             )}
             {categorization.wildOrUnsafe && categorization.wildOrUnsafe.length > 0 && (
               <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1">Unethical / Wild Meat Warn</span>
                  <p className="text-xs text-amber-700 font-bold italic">{categorization.wildOrUnsafe.join(', ')}</p>
               </div>
             )}
             {safetyAlerts && safetyAlerts.length > 0 && (
               <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Ethics & Safety Context</span>
                  {safetyAlerts.map((alert, i) => (
                    <p key={i} className="text-[11px] text-gray-600 font-medium leading-relaxed mb-1">• {alert}</p>
                  ))}
               </div>
             )}
          </div>
        </div>
      </section>

      {/* Recipe Selection Tabs */}
      <div className="flex flex-wrap gap-4 justify-center">
        {recipes.map((r, i) => (
          <button
            key={i}
            onClick={() => setActiveRecipeIndex(i)}
            className={`px-8 py-4 rounded-3xl font-black text-sm transition-all shadow-lg active:scale-95 ${
              activeRecipeIndex === i 
              ? 'bg-black text-white ring-4 ring-black/5' 
              : 'bg-white text-gray-400 border border-gray-100 hover:text-black hover:bg-gray-50'
            }`}
          >
            {r.dishName}
          </button>
        ))}
      </div>

      {/* Main Recipe Card */}
      <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100 transition-all duration-500 transform">
        <div className={`${currentRecipe.dishType === 'Vegetarian' ? 'bg-[#0a2e1f]' : 'bg-[#2a0e0a]'} p-12 text-white relative overflow-hidden`}>
          <div className="absolute -bottom-10 -right-10 opacity-5 rotate-12">
             <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M11 9H9V2H7V9H5V2H3V9C3,11.1 4.5,12.8 6.5,13.2V22H8.5V13.2C10.5,12.8 12,11.1 12,9V2H11V9Z"/></svg>
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
               <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${currentRecipe.dishType === 'Vegetarian' ? 'bg-emerald-400/20 border-emerald-400/30 text-emerald-300' : 'bg-orange-400/20 border-orange-400/30 text-orange-300'}`}>
                 {currentRecipe.dishType}
               </span>
               <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                 {currentRecipe.nutrition.calories} kcal
               </span>
               <div className="bg-white text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ml-auto shadow-xl">
                 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
                 Avg. Time: {currentRecipe.cookingTime}
               </div>
            </div>
            <h2 className="text-5xl md:text-6xl font-serif font-extrabold leading-tight animate-in slide-in-from-left-4 duration-500">{currentRecipe.dishName}</h2>
          </div>
        </div>

        <div className="p-12 space-y-12">
          {/* Nutrition Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {nutritionItems.map((item, i) => (
              <div key={i} className="bg-gray-50/80 p-5 rounded-3xl border border-gray-100 text-center hover:bg-white hover:shadow-md transition-all">
                <span className="text-2xl mb-2 block">{item.icon}</span>
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{item.label}</p>
                <p className="text-base font-black text-black">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Component Analysis */}
          <section>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px bg-gray-100 flex-1"></div>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Required Amounts</h3>
              <div className="h-px bg-gray-100 flex-1"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentRecipe.ingredients.map((ing, i) => (
                <div key={i} className="flex justify-between items-center p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-black transition-all group">
                  <span className="text-sm font-bold text-gray-700 group-hover:text-black">{ing.item}</span>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl">{ing.amount}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Step Sequence */}
          <section>
            <div className="flex items-center gap-4 mb-10">
              <div className="h-px bg-gray-100 flex-1"></div>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Methodology</h3>
              <div className="h-px bg-gray-100 flex-1"></div>
            </div>
            <div className="space-y-8">
              {currentRecipe.steps.map((step, i) => (
                <div key={i} className="flex gap-8 items-start group">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-black font-black text-base border border-gray-100 group-hover:bg-black group-hover:text-white transition-all transform group-hover:scale-110">
                    {(i + 1).toString().padStart(2, '0')}
                  </div>
                  <p className="text-gray-600 leading-[1.8] text-lg pt-1 font-medium animate-in fade-in duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Sources */}
          {sources && sources.length > 0 && (
            <section className="pt-10 border-t border-gray-50">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Culinary Verifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sources.map((source, i) => (
                  <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="p-5 rounded-3xl bg-gray-50/50 border border-gray-100 hover:border-black transition-all group">
                    <p className="text-xs font-bold text-black truncate group-hover:text-indigo-600"> {source.title}</p>
                    <p className="text-[9px] text-gray-400 truncate font-black uppercase tracking-widest mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>
                      Global Knowledge
                    </p>
                  </a>
                ))}
              </div>
            </section>
          )}

          <button onClick={onReset} className="w-full py-7 bg-black text-white rounded-[2.5rem] font-black text-xl hover:bg-gray-900 transition-all shadow-2xl flex items-center justify-center gap-4 active:scale-[0.98]">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
            </svg>
            Flush Pantry & Restart
          </button>
        </div>
      </div>
    </div>
  );
};
