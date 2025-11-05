import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import LoadingSpinner from "@/components/spinner";
import { AlertModal } from "@/components/model/alert";
import CommunityForum from "@/components/community";
import { useAuth } from "../contexts/AuthContext";
import AuthModal from "./AuthModal";
import { authenticatedGet, authenticatedPost } from "../utils/authenticatedApi";
import dynamic from 'next/dynamic';
const NutritionCharts = dynamic(()=>import('./NutritionCharts'), { ssr:false });

// Main meal.it component with advanced nutrition features
export const CalorieCalculatorPage = () => {
    // Authentication state
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    
    // Enhanced state management - ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [foodItems, setFoodItems] = useState([]);
    const [totalCalories, setTotalCalories] = useState(0);
    const [nutritionData, setNutritionData] = useState(null);
    const [isLoading, setLoading] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertType, setAlertType] = useState('error');
    const [activeTab, setActiveTab] = useState('upload');
    const [dailyGoals, setDailyGoals] = useState({ calories: 2000, protein: 150, carbs: 250, fat: 65 });
    const [dailyIntake, setDailyIntake] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    const [nutritionHistory, setNutritionHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState('');
    const [aiRecommendations, setAiRecommendations] = useState(null);
    const [healthAssessment, setHealthAssessment] = useState(null);
    
    const fetchNutritionHistory = useCallback(async () => {
        if (!isAuthenticated) return;
        
        setLoadingHistory(true);
        setHistoryError('');
        try {
            console.log('Fetching nutrition history...');
            const data = await authenticatedGet('/api/nutrition');
            console.log('Nutrition history loaded:', data.length, 'entries');
            // Normalize rows so charts/advice code works uniformly
            const normalized = Array.isArray(data) ? data.map((row) => {
                const nutrition = row?.nutrition || {};
                return {
                    ...row,
                    calories: typeof row.calories === 'number' ? row.calories : (typeof nutrition.calories === 'number' ? nutrition.calories : 0),
                    health_status: row.health_status || 'unknown',
                    timestamp: row.timestamp || row.created_at || new Date().toISOString(),
                };
            }) : [];
            setNutritionHistory(normalized);
        } catch (err) {
            console.error('Error loading nutrition history:', err);
            setHistoryError('Could not load nutrition history.');
        } finally {
            setLoadingHistory(false);
        }
    }, [isAuthenticated]);

    // Fetch nutrition history on mount and when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetchNutritionHistory();
        }
    }, [fetchNutritionHistory, isAuthenticated]);

    const addToHistory = async (foodItems, nutritionData, healthAssessment) => {
        try {
            // Save to database
            console.log('Saving nutrition data to database:', { foodItems, nutritionData, healthAssessment });
            const response = await authenticatedPost('/api/nutrition', {
                food_items: foodItems,
                nutrition: nutritionData,
                health_status: healthAssessment?.label || 'unknown',
                health_advice: healthAssessment?.food_specific_advice || healthAssessment?.advice || '',
                image_url: uploadedImage || null
            });
            
            console.log('Saved successfully:', response);
            
            // Add to local state for immediate display
            const newEntry = {
                id: response.id,
                food_items: foodItems,
                calories: nutritionData?.calories || 0,
                health_status: healthAssessment?.label || 'unknown',
                health_advice: healthAssessment?.food_specific_advice || healthAssessment?.advice || '',
                timestamp: response.timestamp || new Date().toISOString(),
                nutrition: nutritionData,
                ...response
            };
            
            setNutritionHistory(prev => [newEntry, ...prev]);
            return true;
        } catch (error) {
            console.error('Error saving nutrition data:', error);
            throw error;
        }
    };

    // Generate overall diet recommendations based on history
    const generateOverallDietAdvice = (history) => {
        if (!history || history.length < 3) {
            return {
                overall_assessment: "Need more meal data to provide personalized advice. Log at least 3 meals for insights.",
                recommendations: []
            };
        }

        // Analyze recent 7 days of data
        const recentData = history.slice(0, 20); // Last 20 entries
        const totalMeals = recentData.length;
        
        // Calculate averages
        const avgCalories = recentData.reduce((sum, meal) => sum + (meal.calories || 0), 0) / totalMeals;
        const avgProtein = recentData.reduce((sum, meal) => sum + (meal.nutrition?.protein || 0), 0) / totalMeals;
        const avgCarbs = recentData.reduce((sum, meal) => sum + (meal.nutrition?.carbs || 0), 0) / totalMeals;
        const avgFat = recentData.reduce((sum, meal) => sum + (meal.nutrition?.fat || 0), 0) / totalMeals;
        const avgSugar = recentData.reduce((sum, meal) => sum + (meal.nutrition?.sugar || 0), 0) / totalMeals;
        const avgSodium = recentData.reduce((sum, meal) => sum + (meal.nutrition?.sodium || 0), 0) / totalMeals;

        // Analyze health status distribution
        const healthyCount = recentData.filter(meal => meal.health_status === 'healthy').length;
        const unhealthyCount = recentData.filter(meal => meal.health_status === 'unhealthy').length;
        
        const recommendations = [];
        let overallAssessment = "";

        // Generate specific recommendations
        if (avgCalories > 600) {
            recommendations.push("Consider smaller portion sizes - your average meal is quite calorie-dense");
        }
        if (avgCalories < 300) {
            recommendations.push("Your meals seem low in calories - ensure you're getting enough energy throughout the day");
        }
        if (avgProtein < 15) {
            recommendations.push("Increase protein intake with lean meats, fish, eggs, legumes, or dairy products");
        }
        if (avgSugar > 15) {
            recommendations.push("Reduce added sugars - try choosing whole fruits over processed sweet foods");
        }
        if (avgSodium > 500) {
            recommendations.push("Watch your sodium intake - limit processed foods and restaurant meals");
        }
        if (unhealthyCount > totalMeals * 0.4) {
            recommendations.push("Focus on more whole foods - aim for 70% healthy meals to improve overall nutrition");
        }
        if (avgFat > 20) {
            recommendations.push("Consider healthier fat sources like nuts, avocado, and olive oil instead of fried foods");
        }

        // Overall assessment
        const healthyPercentage = Math.round((healthyCount / totalMeals) * 100);
        if (healthyPercentage >= 70) {
            overallAssessment = `Excellent diet patterns! ${healthyPercentage}% of your recent meals are healthy. Keep up the great work with balanced nutrition.`;
        } else if (healthyPercentage >= 50) {
            overallAssessment = `Good progress with ${healthyPercentage}% healthy meals. Small improvements in meal quality could boost your nutrition significantly.`;
        } else {
            overallAssessment = `Your diet has room for improvement with only ${healthyPercentage}% healthy meals. Focus on adding more vegetables, lean proteins, and whole grains.`;
        }

        if (recommendations.length === 0) {
            recommendations.push("Your nutrition looks well-balanced overall! Continue eating a variety of whole foods.");
        }

        return {
            overall_assessment: overallAssessment,
            recommendations: recommendations.slice(0, 4), // Limit to 4 recommendations
            nutrition_summary: {
                avg_calories: Math.round(avgCalories),
                avg_protein: Math.round(avgProtein),
                healthy_percentage: healthyPercentage,
                total_meals_analyzed: totalMeals
            }
        };
    };
    // Meal suggestion feature removed

    // Centralized alert helper
    const showAlertMessage = useCallback((message, type = 'error') => {
        setAlertMessage(message);
        setAlertType(type);
        setShowAlert(true);
    }, []);

    // No authentication, location, or user-specific logic needed for anonymous mode

    // Local image processing and optimization
    const optimizeImageForAnalysis = useCallback((canvas, quality = 0.8) => {
        // Resize if too large to reduce API payload
        const maxWidth = 800;
        const maxHeight = 600;
        
        if (canvas.width > maxWidth || canvas.height > maxHeight) {
            const aspectRatio = canvas.width / canvas.height;
            let newWidth = maxWidth;
            let newHeight = maxHeight;
            
            if (aspectRatio > 1) {
                newHeight = maxWidth / aspectRatio;
            } else {
                newWidth = maxHeight * aspectRatio;
            }
            
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = newWidth;
            tempCanvas.height = newHeight;
            
            tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
            return tempCanvas.toDataURL('image/jpeg', quality);
        }
        
        return canvas.toDataURL('image/jpeg', quality);
    }, []);

    // No login/register/logout logic needed

    

    // Smart image analysis with local pre-processing
    const performSmartAnalysis = useCallback(async (imageDataUrl) => {
        try {
            // Basic local validation - check if image has content
            const img = new Image();
            return new Promise((resolve, reject) => {
                img.onload = async () => {
                    // Simple brightness check to avoid analyzing blank/dark images
                    const tempCanvas = document.createElement('canvas');
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCanvas.width = 100;
                    tempCanvas.height = 100;
                    tempCtx.drawImage(img, 0, 0, 100, 100);
                    
                    const imageData = tempCtx.getImageData(0, 0, 100, 100);
                    const pixels = imageData.data;
                    let totalBrightness = 0;
                    
                    for (let i = 0; i < pixels.length; i += 4) {
                        const r = pixels[i];
                        const g = pixels[i + 1];
                        const b = pixels[i + 2];
                        totalBrightness += (r + g + b) / 3;
                    }
                    
                    const averageBrightness = totalBrightness / (pixels.length / 4);
                    
                    // If image is too dark or too bright, skip analysis
                    if (averageBrightness < 20) {
                        reject(new Error('Image is too dark. Please ensure good lighting.'));
                        return;
                    }
                    
                    if (averageBrightness > 240) {
                        reject(new Error('Image is overexposed. Please adjust lighting.'));
                        return;
                    }
                    
                    // Proceed with API call
                    try {
                        const response = await fetch('/api/detect_food', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ image: imageDataUrl, enhanced: true }),
                        });
                        
                        const data = await response.json();
                        resolve(data);
                    } catch (apiError) {
                        reject(apiError);
                    }
                };
                
                img.onerror = () => {
                    reject(new Error('Invalid image data'));
                };
                
                img.src = imageDataUrl;
            });
        } catch (error) {
            throw error;
        }
    }, []);




    const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                // Create an image element to load the file
                const img = new window.Image();
                img.onload = () => {
                    // Draw to canvas to normalize orientation and resize
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    // Optimize (resize/compress/normalize)
                    const optimized = optimizeImageForAnalysis(canvas, 0.85);
                    setUploadedImage(optimized);
                    sendImageToServer(optimized);
                };
                img.onerror = (error) => {
                    setAlertType('error');
                    setShowAlert(true);
                    setAlertMessage('Error loading the selected image.');
                };
                // Read file as data URL
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target.result;
                };
                reader.onerror = (error) => {
                    setAlertType('error');
                    setShowAlert(true);
                    setAlertMessage('Error reading the selected file.');
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('Error processing file:', error);
                setAlertType('error');
                setShowAlert(true);
                setAlertMessage('Error processing the selected file.');
            }
        }
    };

    // Assessment logic removed for anonymous mode

    // Recommendation logic for anonymous mode (no userProfile)

    const getBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result); // Resolves the promise upon successful file read
            reader.onerror = error => reject(error); // Rejects the promise if file reading fails
            reader.readAsDataURL(file); // Reads the file as a base64 data URL
        });
    };

    // Enhanced image upload component with drag & drop
    const ImageUpload = ({ onUpload, uploadedImage }) => {
        const [isDragging, setIsDragging] = useState(false);

        const handleDragOver = (e) => {
            e.preventDefault();
            setIsDragging(true);
        };

        const handleDragLeave = (e) => {
            e.preventDefault();
            setIsDragging(false);
        };

        const handleDrop = (e) => {
            e.preventDefault();
            setIsDragging(false);
            const files = e.dataTransfer.files;
            if (files[0]) {
                const event = { target: { files: [files[0]] } };
                onUpload(event);
            }
        };

        return (
            <div className="text-center">
                <input id="upload" type="file" accept="image/*" capture="environment" onChange={onUpload} className="hidden" />
                <div 
                    className={`image-container relative h-80 w-full bg-yellow-50 border-2 border-dashed border-yellow-300 overflow-hidden transition-all ${
                        isDragging ? 'border-emerald-500 bg-emerald-100' : 'border-emerald-200 hover:border-emerald-300'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {uploadedImage ? (
                        <Image
                            src={uploadedImage}
                            alt="Analyzed Food"
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 640px"
                        />
                    ) : (
                        <div className="flex flex-col justify-center items-center h-full text-gray-500">
                            <svg className="w-16 h-16 mb-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" />
                            </svg>
                            <p className="text-lg font-medium mb-2">Upload Food Image</p>
                            <p className="text-sm">Drag & drop or click to select</p>
                            <p className="text-xs mt-2 text-gray-400">Supports JPG, PNG, WebP</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // LoginModal removed for anonymous mode

    // Location Permission Modal Component
    const LocationPermissionModal = () => {
        if (!showLocationPermission) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                <div className="bg-white border border-gray-200 max-w-md w-full p-8">
                    {/* Header with Icon */}
                    <div className="text-center mb-6">
                        <div className="bg-yellow-500 text-black p-4 w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            📍 Enable Location Services
                        </h2>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            Get personalized restaurant recommendations and better food delivery options based on your location
                        </p>
                    </div>

                    {/* Benefits */}
                    <div className="space-y-3 mb-6">
                        <div className="flex items-start space-x-3">
                            <div className="bg-green-100 rounded-full p-1 mt-0.5">
                                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">Find nearby restaurants</p>
                                <p className="text-xs text-gray-500">Discover great food options within delivery range</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start space-x-3">
                            <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">Accurate delivery times</p>
                                <p className="text-xs text-gray-500">Get real-time delivery estimates to your location</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start space-x-3">
                            <div className="bg-purple-100 rounded-full p-1 mt-0.5">
                                <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">Cultural cuisine suggestions</p>
                                <p className="text-xs text-gray-500">Local food recommendations based on your area</p>
                            </div>
                        </div>
                    </div>

                    {/* Privacy Note */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                        <div className="flex items-start space-x-2">
                            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="text-xs font-medium text-blue-800">Privacy Protected</p>
                                <p className="text-xs text-blue-600">Your location is stored locally and never shared with third parties</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={requestLocation}
                            className="w-full bg-yellow-500 text-black py-3 px-6 font-semibold hover:bg-yellow-600 transition-colors"
                        >
                            🌟 Enable Location Services
                        </button>
                        
                        <button
                            onClick={() => {
                                setShowLocationPermission(false);
                                setLocationPermission('denied');
                                localStorage.setItem('locationPermission', 'denied');
                            }}
                            className="w-full bg-gray-100 text-gray-700 py-2 px-6 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                        >
                            Skip for now
                        </button>
                    </div>

                    {/* Small text */}
                    <p className="text-center text-xs text-gray-500 mt-4">
                        You can change this setting anytime in your profile
                    </p>
                </div>
            </div>
        );
    };

    // AssessmentModal removed for anonymous mode

    // Enhanced API call for detailed nutrition analysis
    const sendImageToServer = (base64Image) => {
        setLoading(true);
        fetch('/api/detect_food', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: base64Image, enhanced: true }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    setFoodItems(data.items);
                    setTotalCalories(data.count);
                    if (data.nutrition) {
                        setNutritionData(data.nutrition);
                    }
                    if (data.health_assessment) {
                        // Store both health assessment and food-specific advice
                        setHealthAssessment({
                            ...data.health_assessment,
                            food_specific_advice: data.food_specific_advice
                        });
                    }
                    if (data.verdict || data.food_specific_advice) {
                        setAiRecommendations({ verdict: data.verdict, food_specific_advice: data.food_specific_advice });
                    }
                } else {
                    setAlertType('error');
                    setShowAlert(true);
                    setAlertMessage(data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                setAlertType('error');
                setShowAlert(true);
                setAlertMessage('Failed to analyze the image. Please try again.');
            })
            .finally(() => {
                setLoading(false);
            });
    };

    // Quick camera snap component (no persistent live feed)
    const QuickSnap = () => {
        const [cameraOpen, setCameraOpen] = useState(false);
        const [error, setError] = useState('');

        const openCamera = async () => {
            setError('');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                    audio: false
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {});
                    setCameraOpen(true);
                }
            } catch (e) {
                console.error(e);
                setError('Unable to access camera. Please check permissions.');
            }
        };

        const closeCamera = () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach(t => t.stop());
                videoRef.current.srcObject = null;
            }
            setCameraOpen(false);
        };

        const snapAndAnalyze = async () => {
            if (!videoRef.current || !canvasRef.current) return;
            setLoading(true);
            try {
                const canvas = canvasRef.current;
                const video = videoRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                const optimized = optimizeImageForAnalysis(canvas, 0.85);

                const res = await fetch('/api/detect_food', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: optimized, enhanced: true })
                });
                const data = await res.json();
                if (data.success) {
                    setFoodItems(data.items);
                    setTotalCalories(data.count);
                    setNutritionData(data.nutrition || null);
                    setUploadedImage(optimized);
                } else {
                    setAlertType('error');
                    setShowAlert(true);
                    setAlertMessage(data.message || 'Analysis failed.');
                }
            } catch (e) {
                console.error('Quick snap analyze error:', e);
                setAlertType('error');
                setShowAlert(true);
                setAlertMessage('Failed to analyze the image.');
            } finally {
                setLoading(false);
                closeCamera();
            }
        };

        return (
            <div className="text-center">
                <div className="relative h-80 w-full bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
                    {cameraOpen ? (
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex flex-col items-center text-white">
                            <svg className="w-16 h-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            </svg>
                            <p className="text-gray-300 mb-2">Take a quick photo with your camera</p>
                            <p className="text-xs text-gray-400 mb-4">No need to upload. One tap analysis.</p>
                            <button onClick={openCamera} className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 font-semibold transition-colors">Open Camera</button>
                            {error && <p className="text-red-300 mt-3 text-sm">{error}</p>}
                        </div>
                    )}
                </div>
                <canvas ref={canvasRef} className="hidden" />

                {/* Controls */}
                {cameraOpen && (
                    <div className="mt-4 flex items-center justify-center gap-3">
                        <button onClick={snapAndAnalyze} className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 font-semibold">Snap & Analyze</button>
                        <button onClick={closeCamera} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 font-semibold">Cancel</button>
                    </div>
                )}
            </div>
        );
    };
    

    // Removed duplicate DailyProgress definition to avoid redeclare errors

    // Diet Plan View Component
    const DietPlanView = ({ dietPlan }) => {
        if (!dietPlan) return null;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-orange-50 border border-orange-200">
                        <div className="text-2xl font-bold text-orange-600">{dietPlan.dailyCalories}</div>
                        <div className="text-sm text-gray-600">Daily Calories</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 border border-blue-200">
                        <div className="text-2xl font-bold text-blue-600">{dietPlan.macros?.protein}g</div>
                        <div className="text-sm text-gray-600">Protein</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 border border-green-200">
                        <div className="text-2xl font-bold text-green-600">{dietPlan.macros?.carbs}g</div>
                        <div className="text-sm text-gray-600">Carbs</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 border border-purple-200">
                        <div className="text-2xl font-bold text-purple-600">{dietPlan.macros?.fat}g</div>
                        <div className="text-sm text-gray-600">Fat</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(dietPlan.mealPlan || {}).map(([meal, details]) => (
                        <div key={meal} className="border border-gray-200 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-800 capitalize mb-2">{meal} - {details.calories} cal</h4>
                            <div className="space-y-2">
                                {details.foods?.map((food, index) => (
                                    <div key={index} className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                        {food}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                                P: {details.macros?.protein}g | C: {details.macros?.carbs}g | F: {details.macros?.fat}g
                            </div>
                        </div>
                    ))}
                </div>

                {dietPlan.tips && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <h4 className="font-semibold text-emerald-800 mb-2">Personalized Tips</h4>
                        <ul className="space-y-1">
                            {dietPlan.tips.map((tip, index) => (
                                <li key={index} className="text-sm text-emerald-700 flex items-start">
                                    <span className="mr-2">•</span>
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Update Diet Plan button removed for anonymous mode */}
            </div>
        );
    };

    // Nutrition History View Component
    const NutritionHistoryView = ({ history }) => {
        if (!history || history.length === 0) {
            return (
                <div className="text-center py-8">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-500 mb-2">No nutrition history yet.</p>
                    <p className="text-sm text-gray-400">Start analyzing food to build your history!</p>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">Recent Meals ({history.length})</h3>
                    <button 
                        onClick={() => {
                            setNutritionHistory([]);
                            localStorage.removeItem('nutritionHistory');
                        }}
                        className="text-xs text-gray-500 hover:text-red-600"
                    >
                        Clear
                    </button>
                </div>
                {history.slice(0, 10).map((entry, index) => (
                    <div key={entry.id || index} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-wrap gap-1">
                                {(entry.food_items || []).map((item, idx) => (
                                    <span key={idx} className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-medium">
                                        {item}
                                    </span>
                                ))}
                            </div>
                            <span className="text-xs text-gray-500">
                                {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <div className="text-sm">
                                <span className="font-bold text-orange-600">{entry.calories}</span>
                                <span className="text-gray-500 text-xs ml-1">calories</span>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-semibold ${
                                entry.health_status === 'healthy' ? 'bg-green-100 text-green-700' :
                                entry.health_status === 'unhealthy' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                                {entry.health_status}
                            </div>
                        </div>
                        
                        {entry.health_advice && (
                            <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                                {entry.health_advice}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    // Closes the alert modal
    const closeAlertModal = () => setShowAlert(false);

    // Enhanced nutrition analysis display
    const NutritionAnalysis = () => {
        if (foodItems.length === 0) {
            return (
                <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                    <div className="w-24 h-24 bg-yellow-100 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Nutrition Analysis</h3>
                    <p className="text-gray-500">Upload an image or use live camera to get detailed nutrition breakdown</p>
                </div>
            );
        }

        return (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Food Items */}
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Detected Foods</h3>
                    <div className="flex flex-wrap gap-2">
                        {foodItems.map((item, index) => (
                            <span key={index} className="bg-yellow-100 text-yellow-700 px-4 py-2 text-sm font-medium">
                                {item}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Calories & Macros */}
                <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="text-center p-4 bg-orange-50 border border-orange-200">
                            <div className="text-2xl font-bold text-orange-600">{totalCalories}</div>
                            <div className="text-sm text-gray-600">Calories</div>
                        </div>
                        <div className="text-center p-4 bg-blue-50 border border-blue-200">
                            <div className="text-2xl font-bold text-blue-600">{nutritionData?.protein || 0}g</div>
                            <div className="text-sm text-gray-600">Protein</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 border border-green-200">
                            <div className="text-2xl font-bold text-green-600">{nutritionData?.carbs || 0}g</div>
                            <div className="text-sm text-gray-600">Carbs</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 border border-purple-200">
                            <div className="text-2xl font-bold text-purple-600">{nutritionData?.fat || 0}g</div>
                            <div className="text-sm text-gray-600">Fat</div>
                        </div>
                    </div>

                    {/* Additional Nutrition Info */}
                    {nutritionData && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Fiber:</span>
                                <span className="font-medium">{nutritionData.fiber}g</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Sugar:</span>
                                <span className="font-medium">{nutritionData.sugar}g</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Sodium:</span>
                                <span className="font-medium">{nutritionData.sodium}mg</span>
                            </div>
                        </div>
                    )}
                    {healthAssessment && (
                        <div className={`mt-6 p-4 rounded border text-sm leading-relaxed space-y-2 ${healthAssessment.label==='healthy' ? 'border-emerald-400 bg-emerald-50' : healthAssessment.label==='unhealthy' ? 'border-red-400 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold tracking-wide uppercase ${healthAssessment.label==='healthy' ? 'bg-emerald-500 text-white' : healthAssessment.label==='unhealthy' ? 'bg-red-600 text-white' : 'bg-amber-400 text-gray-900'}`}>{healthAssessment.label}</span>
                                <span className="text-gray-800 font-medium">Food Analysis</span>
                            </div>
                            {healthAssessment.food_specific_advice && (
                                <div className="text-gray-700 font-medium bg-white bg-opacity-60 p-3 rounded">
                                    {healthAssessment.food_specific_advice}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Add to Daily Intake Button */}
                    <button
                        onClick={async () => {
                            if (nutritionData) {
                                setDailyIntake(prev => ({
                                    calories: prev.calories + nutritionData.calories,
                                    protein: prev.protein + nutritionData.protein,
                                    carbs: prev.carbs + nutritionData.carbs,
                                    fat: prev.fat + nutritionData.fat
                                }));
                                // Add to nutrition history in Supabase
                                // Save to database and add to history
                                try {
                                    await addToHistory(foodItems, nutritionData, healthAssessment);
                                    setAlertType('success');
                                    setShowAlert(true);
                                    setAlertMessage('Successfully added to your daily nutrition tracking!');
                                } catch (error) {
                                    console.error('Failed to save nutrition data:', error);
                                    setAlertType('error');
                                    setShowAlert(true);
                                    setAlertMessage('Failed to save nutrition data. Please try again.');
                                }

                            }
                        }}
                        className="w-full mt-6 bg-yellow-500 text-black py-3 font-medium hover:bg-yellow-600 transition-colors"
                    >
                        Add to Daily Intake
                    </button>
                </div>
            </div>
        );
    };

    // Daily progress sidebar component
    const DailyProgress = () => {
        const Bar = ({ label, value, goal, color }) => {
            const pct = Math.min(100, Math.round((value / Math.max(1, goal)) * 100));
            const barColor = color || 'bg-emerald-500';
            return (
                <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{label}</span>
                        <span className="text-gray-500">{value}{label === 'Calories' ? '' : 'g'} / {goal}{label === 'Calories' ? '' : 'g'}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                </div>
            );
        };

        return (
            <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Progress</h3>
                <Bar label="Calories" value={dailyIntake.calories} goal={dailyGoals.calories} color="bg-orange-500" />
                <Bar label="Protein" value={dailyIntake.protein} goal={dailyGoals.protein} color="bg-blue-500" />
                <Bar label="Carbs" value={dailyIntake.carbs} goal={dailyGoals.carbs} color="bg-green-500" />
                <Bar label="Fat" value={dailyIntake.fat} goal={dailyGoals.fat} color="bg-purple-500" />

                <div className="grid grid-cols-1 gap-3 mt-4">
                    {/* Meal suggestions button removed for anonymous mode */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                setDailyGoals(prev => ({ ...prev, calories: prev.calories + 100 }));
                                setAlertType('success');
                                setShowAlert(true);
                                setAlertMessage('Increased calorie goal by 100');
                            }}
                            className="border border-yellow-300 text-yellow-700 py-2 hover:bg-yellow-50 transition-colors text-sm"
                        >
                            +100 cal
                        </button>
                        <button
                            onClick={() => {
                                setDailyGoals({ calories: 2000, protein: 150, carbs: 250, fat: 65 });
                                setAlertType('success');
                                setShowAlert(true);
                                setAlertMessage('Goals reset to defaults');
                            }}
                            className="border border-gray-300 text-gray-700 py-2 hover:bg-gray-50 transition-colors text-sm"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Show loading while checking authentication
    if (authLoading) {
        return (
            <div className="min-h-screen bg-white font-sans flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    // Show loading spinner while authentication is being checked
    if (authLoading) {
        return (
            <div className="min-h-screen bg-white font-sans flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    // Show authentication prompt if not logged in
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-white font-sans">
                {/* Header Section */}
                <div className="container mx-auto px-4 py-8">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl md:text-5xl font-bold text-yellow-600 mb-4">
                            meal.it: Professional Nutrition Analysis
                        </h1>
                        <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
                            Your personal nutrition tracking platform. Sign in to analyze your meals, track your nutrition, and get personalized diet insights.
                        </p>
                    </div>

                    {/* Authentication Required Card */}
                    <div className="max-w-md mx-auto">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
                            <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-3">
                                Sign In Required
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Create a free account to start tracking your nutrition journey. Your data will be private and secure.
                            </p>
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                            >
                                Get Started Free
                            </button>
                        </div>
                    </div>
                </div>

                {/* Auth Modal */}
                <AuthModal
                    isOpen={showAuthModal}
                    onClose={() => setShowAuthModal(false)}
                    mode="signup"
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white font-sans">
            {isLoading && <LoadingSpinner />}
            {/* Header Section */}
            <div className="container mx-auto px-4 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-yellow-600 mb-4">
                        meal.it: Professional Nutrition Analysis
                    </h1>
                    <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
                        Welcome back! Analyze your meals, track your nutrition, and get personalized diet insights tailored just for you.
                    </p>
                </div>
                {/* Main Content */}
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column - Input Methods */}
                        <div className="lg:col-span-2">
                            {/* User Actions Bar */}
                            <div className="bg-white rounded-xl shadow-lg mb-6 p-4">
                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => setActiveTab('upload')}
                                        className={`py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center ${
                                            activeTab === 'upload' 
                                                ? 'bg-yellow-500 text-black' 
                                                : 'border border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                        }`}
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        Analyze Food
                                    </button>
                                </div>
                            </div>

                            {/* Food Analysis Section */}
                            <div className="bg-white rounded-xl shadow-lg mb-6">
                                <div className="p-6">
                                    <ImageUpload onUpload={handleImageUpload} uploadedImage={uploadedImage} />
                                    <label htmlFor="upload" className="block mt-4">
                                        <span className="w-full bg-yellow-500 text-black py-3 px-6 font-medium hover:bg-yellow-600 transition-colors cursor-pointer inline-block text-center">
                                            Select Food Image
                                        </span>
                                    </label>
                                </div>
                            </div>
                            
                            {/* Nutrition Analysis */}
                            <NutritionAnalysis />
                        </div>
                        
                                                {/* Right Column - Daily Progress & Tabbed Insights */}
                                                <div className="space-y-6">
                                                    <DailyProgress />
                                                    <div className="bg-white rounded-xl shadow">
                                                        <div className="flex border-b text-sm font-medium">
                                                            {['trends','insights','history'].map(t => (
                                                                <button key={t} onClick={()=>setActiveTab(t)}
                                                                    className={`flex-1 px-4 py-2 hover:bg-gray-50 ${activeTab===t? 'bg-yellow-500 text-black' : 'text-gray-600'}`}> 
                                                                    {t==='trends' ? 'Trends' : t==='insights' ? 'AI Advice' : 'History'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="p-4 md:p-6">
                                                            {activeTab==='trends' && (
                                                                <NutritionCharts 
                                                                    nutritionHistory={nutritionHistory}
                                                                    onRecommendations={(r)=>setAiRecommendations(r)} 
                                                                />
                                                            )}
                                                            {activeTab==='insights' && (
                                                                <div className="space-y-4">
                                                                    {/* Recent Food Analysis */}
                                                                    {aiRecommendations?.food_specific_advice && (
                                                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-600 text-white">Latest Food</span>
                                                                                {aiRecommendations.verdict && <span className="text-xs text-gray-600">{aiRecommendations.verdict}</span>}
                                                                            </div>
                                                                            <p className="text-sm text-blue-800">{aiRecommendations.food_specific_advice}</p>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Overall Diet Analysis */}
                                                                    {(() => {
                                                                        const overallAdvice = generateOverallDietAdvice(nutritionHistory);
                                                                        return (
                                                                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                                                                <h4 className="font-semibold text-emerald-800 mb-3">Diet Pattern Analysis</h4>
                                                                                
                                                                                <div className="mb-3">
                                                                                    <p className="text-sm text-emerald-700 leading-relaxed">{overallAdvice.overall_assessment}</p>
                                                                                </div>
                                                                                
                                                                                {overallAdvice.nutrition_summary && (
                                                                                    <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2 bg-white bg-opacity-60 rounded">
                                                                                        <div>Avg Calories: <span className="font-semibold">{overallAdvice.nutrition_summary.avg_calories}</span></div>
                                                                                        <div>Avg Protein: <span className="font-semibold">{overallAdvice.nutrition_summary.avg_protein}g</span></div>
                                                                                        <div>Healthy Meals: <span className="font-semibold">{overallAdvice.nutrition_summary.healthy_percentage}%</span></div>
                                                                                        <div>Total Analyzed: <span className="font-semibold">{overallAdvice.nutrition_summary.total_meals_analyzed}</span></div>
                                                                                    </div>
                                                                                )}
                                                                                
                                                                                <div>
                                                                                    <h5 className="font-medium text-emerald-800 mb-2">Recommendations</h5>
                                                                                    <ul className="space-y-1">
                                                                                        {overallAdvice.recommendations.map((rec, i) => (
                                                                                            <li key={i} className="text-sm text-emerald-700 flex items-start">
                                                                                                <span className="mr-2 text-emerald-500">•</span>
                                                                                                {rec}
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            )}
                                                            {activeTab==='history' && (
                                                                <NutritionHistoryView history={nutritionHistory} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {/* AssessmentModal removed for anonymous mode */}
            
            {/* Login Prompt removed for anonymous mode */}
            
            <AlertModal show={showAlert} onClose={closeAlertModal} type={alertType} message={alertMessage} />
        </div>
    );
};
