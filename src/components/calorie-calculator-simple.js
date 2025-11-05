import { useState, useEffect } from "react";
import Image from "next/image";
import LoadingSpinner from "@/components/spinner";
import { AlertModal } from "@/components/model/alert";

// Enhanced meal.it component with smart features
export const CalorieCalculatorPage = () => {
    // Core states
    const [uploadedImage, setUploadedImage] = useState(null);
    const [isLoading, setLoading] = useState(false);
    const [nutritionData, setNutritionData] = useState(null);
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    
    // Anonymous mode: no user management states
    
    // Nutrition tracking states
    const [activeTab, setActiveTab] = useState('upload');
    const [dailyGoals, setDailyGoals] = useState({ calories: 2000, protein: 150, carbs: 250, fat: 65 });
    const [dailyIntake, setDailyIntake] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    const [nutritionHistory, setNutritionHistory] = useState([]);
    
    // Smart features states
    const [recommendations, setRecommendations] = useState(null);
    const [loadingRecommendations, setLoadingRecommendations] = useState(false);
    const [loadingDietPlan, setLoadingDietPlan] = useState(false);

    // Anonymous mode: no user data load

    // Save user data when it changes
    // Anonymous mode: no user-specific daily intake save

    // Anonymous mode: no user-specific nutrition history save

    // Anonymous mode: no user profile save
    
    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setUploadedImage(imageUrl);
        }
    };

    const showAlertMessage = (message) => {
        setAlertMessage(message);
        setShowAlert(true);
    };

    const closeAlertModal = () => {
        setShowAlert(false);
        setAlertMessage('');
    };

    const analyzeFood = async () => {
        if (!uploadedImage) return;
        setLoading(true);
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = async () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const base64Data = canvas.toDataURL('image/jpeg', 0.8);
                const response = await fetch('/api/detect_food', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64Data })
                });
                const data = await response.json();
                if (data.success) {
                    setNutritionData(data.nutritionData);
                    // Update daily intake and history for anonymous mode
                    const newIntake = {
                        calories: dailyIntake.calories + (data.nutritionData.calories || 0),
                        protein: dailyIntake.protein + (data.nutritionData.protein || 0),
                        carbs: dailyIntake.carbs + (data.nutritionData.carbs || 0),
                        fat: dailyIntake.fat + (data.nutritionData.fat || 0)
                    };
                    setDailyIntake(newIntake);
                    const historyEntry = {
                        ...data.nutritionData,
                        timestamp: new Date().toISOString(),
                        image: uploadedImage
                    };
                    setNutritionHistory([...nutritionHistory, historyEntry]);
                    showAlertMessage('Food analysis completed successfully! Your daily intake has been updated.');
                } else {
                    showAlertMessage('Analysis failed: ' + data.message);
                }
                setLoading(false);
            };
            img.src = uploadedImage;
        } catch (error) {
            showAlertMessage('Error: ' + error.message);
            setLoading(false);
        }
    };

    // Anonymous mode: no authentication functions

    // Anonymous mode: no assessment handling

    // Anonymous mode: no diet plan generation

    // Anonymous mode: no meal recommendations

    // Anonymous mode: no login or assessment modals

    const AssessmentModal = () => {
        const [assessmentData, setAssessmentData] = useState({
            activityLevel: '',
            healthGoals: [],
            dietaryRestrictions: [],
            medicalConditions: [],
            preferences: []
        });

        if (!showAssessment) return null;

        const handleSubmit = (e) => {
            e.preventDefault();
            handleAssessmentComplete(assessmentData);
        };

        const toggleArrayItem = (array, item, setter) => {
            const newArray = array.includes(item) 
                ? array.filter(i => i !== item)
                : [...array, item];
            setter(newArray);
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Health Assessment</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-6">
                            {/* Activity Level */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Activity Level</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'].map(level => (
                                        <label key={level} className="flex items-center">
                                            <input
                                                type="radio"
                                                value={level}
                                                checked={assessmentData.activityLevel === level}
                                                onChange={(e) => setAssessmentData({...assessmentData, activityLevel: e.target.value})}
                                                className="mr-2"
                                            />
                                            {level}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Health Goals */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Health Goals</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['Weight Loss', 'Weight Gain', 'Muscle Building', 'Maintenance', 'Better Energy', 'Improved Health'].map(goal => (
                                        <label key={goal} className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={assessmentData.healthGoals.includes(goal)}
                                                onChange={() => toggleArrayItem(assessmentData.healthGoals, goal, 
                                                    (newGoals) => setAssessmentData({...assessmentData, healthGoals: newGoals}))}
                                                className="mr-2"
                                            />
                                            {goal}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Dietary Restrictions */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Restrictions</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo'].map(restriction => (
                                        <label key={restriction} className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={assessmentData.dietaryRestrictions.includes(restriction)}
                                                onChange={() => toggleArrayItem(assessmentData.dietaryRestrictions, restriction,
                                                    (newRestrictions) => setAssessmentData({...assessmentData, dietaryRestrictions: newRestrictions}))}
                                                className="mr-2"
                                            />
                                            {restriction}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2 mt-6">
                            <button
                                type="button"
                                onClick={() => setShowAssessment(false)}
                                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Skip
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2 bg-yellow-500 text-black hover:bg-yellow-600"
                            >
                                Complete Assessment
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-white">
            {(isLoading || loadingDietPlan || loadingRecommendations) && <LoadingSpinner />}
            
            {/* Hero Section */}
            <div className="container mx-auto px-4 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-yellow-600 mb-4">
                        Smart Nutrition Analysis
                    </h1>
                    <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
                        Get instant nutrition insights with AI-powered food recognition and personalized diet planning
                    </p>
                    
                    {/* User Status Bar */}
                    {currentUser && (
                        <div className="bg-yellow-100 p-4 mb-6 inline-block">
                            <span className="text-emerald-700 font-medium">Welcome back, {currentUser.name}!</span>
                            <button
                                onClick={handleLogout}
                                className="ml-4 text-yellow-600 hover:text-yellow-800 text-sm underline"
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>

                {/* Main Content Grid */}
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* Left Column - Main Interface */}
                        <div className="lg:col-span-2">
                            {/* User Actions Bar */}
                            {currentUser && (
                                <div className="bg-white rounded-xl shadow-lg mb-6 p-4">
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            onClick={() => !userProfile ? setShowAssessment(true) : generateDietPlan()}
                                            disabled={loadingDietPlan}
                                            className="bg-blue-500 text-white px-4 py-2 font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                                        >
                                            {loadingDietPlan ? 'Generating...' : !userProfile ? 'Complete Assessment' : 'Generate Diet Plan'}
                                        </button>
                                        <button
                                            onClick={getMealRecommendations}
                                            disabled={loadingRecommendations}
                                            className="bg-red-500 text-white px-4 py-2 font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                                        >
                                            {loadingRecommendations ? 'Loading...' : 'Get Meal Suggestions'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Tabbed Interface */}
                            <div className="bg-white rounded-xl shadow-lg">
                                {/* Tab Navigation */}
                                <div className="flex border-b border-gray-200">
                                    <button
                                        onClick={() => setActiveTab('upload')}
                                        className={`flex-1 py-3 px-4 text-center font-medium ${activeTab === 'upload' ? 'text-yellow-600 border-b-2 border-yellow-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Upload & Analyze
                                    </button>
                                    {currentUser && userProfile?.dietPlan && (
                                        <button
                                            onClick={() => setActiveTab('dietPlan')}
                                            className={`flex-1 py-3 px-4 text-center font-medium ${activeTab === 'dietPlan' ? 'text-yellow-600 border-b-2 border-yellow-600' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Diet Plan
                                        </button>
                                    )}
                                    {currentUser && (
                                        <>
                                            <button
                                                onClick={() => setActiveTab('history')}
                                                className={`flex-1 py-3 px-4 text-center font-medium ${activeTab === 'history' ? 'text-yellow-600 border-b-2 border-yellow-600' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                History
                                            </button>
                                            {recommendations && (
                                                <button
                                                    onClick={() => setActiveTab('recommendations')}
                                                    className={`flex-1 py-3 px-4 text-center font-medium ${activeTab === 'recommendations' ? 'text-yellow-600 border-b-2 border-yellow-600' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    Recommendations
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Tab Content */}
                                <div className="p-6">
                                    {activeTab === 'upload' && (
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Food Analysis</h2>
                                            
                                            {/* Image Upload */}
                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    className="hidden"
                                                    id="imageInput"
                                                />
                                                <label htmlFor="imageInput" className="cursor-pointer">
                                                    {uploadedImage ? (
                                                        <Image
                                                            src={uploadedImage}
                                                            alt="Uploaded food"
                                                            width={512}
                                                            height={512}
                                                            className="max-w-full h-64 mx-auto object-contain rounded-lg"
                                                            sizes="(max-width: 768px) 100vw, 512px"
                                                        />
                                                    ) : (
                                                        <div>
                                                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                            </svg>
                                                            <p className="text-gray-600">Click to upload an image</p>
                                                        </div>
                                                    )}
                                                </label>
                                            </div>

                                            {/* Analyze Button */}
                                            {uploadedImage && (
                                                <div className="mt-6 text-center">
                                                    <button
                                                        onClick={analyzeFood}
                                                        disabled={isLoading}
                                                        className="bg-yellow-500 text-black px-8 py-3 font-semibold hover:bg-yellow-600 transition-colors disabled:opacity-50"
                                                    >
                                                        {isLoading ? 'Analyzing...' : 'Analyze Nutrition'}
                                                    </button>
                                                </div>
                                            )}

                                            {/* Results Display */}
                                            {nutritionData && (
                                                <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                                                    <h3 className="text-xl font-bold text-gray-800 mb-4">Nutrition Analysis</h3>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        <div className="text-center">
                                                            <div className="text-2xl font-bold text-yellow-600">{nutritionData.calories}</div>
                                                            <div className="text-sm text-gray-600">Calories</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-2xl font-bold text-blue-600">{nutritionData.protein}g</div>
                                                            <div className="text-sm text-gray-600">Protein</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-2xl font-bold text-yellow-600">{nutritionData.carbs}g</div>
                                                            <div className="text-sm text-gray-600">Carbs</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-2xl font-bold text-purple-600">{nutritionData.fat}g</div>
                                                            <div className="text-sm text-gray-600">Fat</div>
                                                        </div>
                                                    </div>
                                                    {nutritionData.items && (
                                                        <div className="mt-4">
                                                            <h4 className="font-semibold text-gray-700 mb-2">Detected Foods:</h4>
                                                            <ul className="list-disc list-inside text-gray-600">
                                                                {nutritionData.items.map((item, index) => (
                                                                    <li key={index}>{item.name} - {item.calories} cal</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'dietPlan' && userProfile?.dietPlan && (
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Personalized Diet Plan</h2>
                                            <div className="space-y-6">
                                                {/* Daily Targets */}
                                                <div className="bg-blue-50 p-4">
                                                    <h3 className="text-lg font-semibold mb-2">Daily Nutrition Targets</h3>
                                                    <div className="grid grid-cols-4 gap-4 text-center">
                                                        <div>
                                                            <div className="text-xl font-bold text-blue-600">{userProfile.dietPlan.dailyTargets?.calories || 'N/A'}</div>
                                                            <div className="text-sm text-gray-600">Calories</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xl font-bold text-green-600">{userProfile.dietPlan.dailyTargets?.protein || 'N/A'}g</div>
                                                            <div className="text-sm text-gray-600">Protein</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xl font-bold text-yellow-600">{userProfile.dietPlan.dailyTargets?.carbs || 'N/A'}g</div>
                                                            <div className="text-sm text-gray-600">Carbs</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xl font-bold text-purple-600">{userProfile.dietPlan.dailyTargets?.fat || 'N/A'}g</div>
                                                            <div className="text-sm text-gray-600">Fat</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Meal Plan */}
                                                {userProfile.dietPlan.mealPlan && (
                                                    <div>
                                                        <h3 className="text-lg font-semibold mb-3">Recommended Meals</h3>
                                                        <div className="space-y-4">
                                                            {Object.entries(userProfile.dietPlan.mealPlan).map(([meal, details]) => (
                                                                <div key={meal} className="border border-gray-200 rounded-lg p-4">
                                                                    <h4 className="font-medium text-gray-800 capitalize mb-2">{meal}</h4>
                                                                    <p className="text-gray-600 text-sm">{details}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'history' && (
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Nutrition History</h2>
                                            {nutritionHistory.length > 0 ? (
                                                <div className="space-y-4">
                                                    {nutritionHistory.slice(-10).reverse().map((entry, index) => (
                                                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="text-sm text-gray-500">
                                                                    {new Date(entry.timestamp).toLocaleString()}
                                                                </span>
                                                                <div className="flex gap-4 text-sm">
                                                                    <span>{entry.calories} cal</span>
                                                                    <span>{entry.protein}g protein</span>
                                                                    <span>{entry.carbs}g carbs</span>
                                                                    <span>{entry.fat}g fat</span>
                                                                </div>
                                                            </div>
                                                            {entry.items && (
                                                                <div className="text-sm text-gray-600">
                                                                    {entry.items.map(item => item.name).join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-gray-500 text-center py-8">No nutrition data recorded yet. Start by analyzing some food!</p>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'recommendations' && recommendations && (
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Meal Recommendations</h2>
                                            <div className="grid gap-6">
                                                {['breakfast', 'lunch', 'dinner', 'snacks'].map(mealType => {
                                                    const mealRecs = recommendations[mealType];
                                                    if (!mealRecs || !mealRecs.length) return null;
                                                    
                                                    return (
                                                        <div key={mealType} className="border border-gray-200 rounded-lg p-4">
                                                            <h3 className="text-lg font-semibold mb-3 capitalize">{mealType}</h3>
                                                            <div className="space-y-2">
                                                                {mealRecs.map((rec, index) => (
                                                                    <div key={index} className="bg-gray-50 p-3 rounded">
                                                                        <div className="font-medium">{rec.name}</div>
                                                                        <div className="text-sm text-gray-600">{rec.reason}</div>
                                                                        <div className="text-xs text-gray-500 mt-1">
                                                                            {rec.calories} cal • {rec.protein}g protein • {rec.carbs}g carbs • {rec.fat}g fat
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Daily Progress */}
                        <div>
                            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-4">
                                <h3 className="text-xl font-bold text-gray-800 mb-4">Daily Progress</h3>
                                
                                {currentUser ? (
                                    <div className="space-y-4">
                                        {/* Progress Bars */}
                                        {[
                                            { name: 'Calories', current: dailyIntake.calories, goal: dailyGoals.calories, color: 'emerald' },
                                            { name: 'Protein', current: dailyIntake.protein, goal: dailyGoals.protein, color: 'blue', unit: 'g' },
                                            { name: 'Carbs', current: dailyIntake.carbs, goal: dailyGoals.carbs, color: 'yellow', unit: 'g' },
                                            { name: 'Fat', current: dailyIntake.fat, goal: dailyGoals.fat, color: 'purple', unit: 'g' }
                                        ].map(item => {
                                            const percentage = Math.min((item.current / item.goal) * 100, 100);
                                            return (
                                                <div key={item.name}>
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-sm font-medium">{item.name}</span>
                                                        <span className="text-sm text-gray-500">
                                                            {Math.round(item.current)}{item.unit || ''} / {item.goal}{item.unit || ''}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className={`bg-${item.color}-500 h-2 rounded-full transition-all duration-300`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <p className="text-gray-500 mb-4">Login to track your daily nutrition progress</p>
                                        <button
                                            onClick={() => setShowLogin(true)}
                                            className="bg-yellow-500 text-black px-4 py-2 hover:bg-yellow-600 transition-colors"
                                        >
                                            Login / Sign Up
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {/* Login, assessment, and login prompt removed for anonymous mode */}
            
            <AlertModal 
                show={showAlert} 
                onClose={closeAlertModal} 
                type={alertMessage.includes('success') ? 'success' : 'error'} 
                message={alertMessage} 
            />
        </div>
    );
};