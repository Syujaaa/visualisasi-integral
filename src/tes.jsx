import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import "./App.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title
);

export default function App() {
  const [imgSrc, setImgSrc] = useState(null);
  const [processedImg, setProcessedImg] = useState(null);
  const [areaPixel, setAreaPixel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [riemannMethod, setRiemannMethod] = useState("midpoint");
  const [riemannIntervals, setRiemannIntervals] = useState(10);
  const [riemannData, setRiemannData] = useState(null);
  const [showRiemannGraph, setShowRiemannGraph] = useState(false);
  const [mathExplanation, setMathExplanation] = useState("");
  const [error, setError] = useState("");
  const [showRiemannControls, setShowRiemannControls] = useState(false);
  const [calculationSteps, setCalculationSteps] = useState([]);
  const [showStepByStep, setShowStepByStep] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [calculationHistory, setCalculationHistory] = useState([]);
  const [detectionMethod, setDetectionMethod] = useState("automatic"); // automatic, manual_threshold, edge_based
  const [manualThreshold, setManualThreshold] = useState(128);
  const [showDetectionControls, setShowDetectionControls] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(0);

  const previewCanvasRef = useRef(null);
  const processedCanvasRef = useRef(null);
  const riemannCanvasRef = useRef(null);
  const histogramCanvasRef = useRef(null);

  const formatNumber = (num) => {
    return Math.round(num)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const formatNumberWithDecimal = (num, decimalPlaces = 2) => {
    if (typeof num !== "number" || isNaN(num)) return "0";

    const rounded = Math.round(num);
    const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    if (decimalPlaces > 0) {
      const decimalPart = (num - rounded).toFixed(decimalPlaces).substring(2);
      if (decimalPart !== "00") {
        return `${formatted},${decimalPart}`;
      }
    }

    return formatted;
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".png")) {
      setError("Hanya format PNG yang diterima. Silakan upload file PNG.");
      return;
    }

    setError("");
    setIsProcessing(true);
    setImgSrc(URL.createObjectURL(file));
    setProcessedImg(null);
    setAreaPixel(0);
    setRiemannData(null);
    setShowRiemannGraph(false);
    setShowRiemannControls(false);
    setMathExplanation("");
    setCalculationSteps([]);
    setCalculationHistory([]);
    setShowStepByStep(true);
    setCurrentStep(0);
    setDetectedObjects([]);
    setSelectedObjectIndex(0);
    setShowDetectionControls(true);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/png": [".png"] },
    maxFiles: 1,
  });

  useEffect(() => {
    if (imgSrc && isProcessing) {
      processImageAutomatically();
    }
  }, [imgSrc, isProcessing]);

  // Fungsi untuk menghitung histogram gambar
  const calculateHistogram = (imageData) => {
    const histogram = new Array(256).fill(0);
    
    // Hitung histogram dari intensitas grayscale
    for (let i = 0; i < imageData.data.length; i += 4) {
      // Konversi RGB ke grayscale
      const gray = Math.round(
        0.299 * imageData.data[i] +
        0.587 * imageData.data[i + 1] +
        0.114 * imageData.data[i + 2]
      );
      histogram[gray]++;
    }
    
    return histogram;
  };

  // Fungsi untuk mendeteksi threshold otomatis menggunakan metode Otsu
  const findOtsuThreshold = (histogram, totalPixels) => {
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }
    
    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVariance = 0;
    let threshold = 0;
    
    for (let i = 0; i < 256; i++) {
      wB += histogram[i];
      if (wB === 0) continue;
      
      wF = totalPixels - wB;
      if (wF === 0) break;
      
      sumB += i * histogram[i];
      
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      
      // Hitung variance antar kelas
      const variance = wB * wF * (mB - mF) * (mB - mF);
      
      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = i;
      }
    }
    
    return threshold;
  };

  // Fungsi untuk mengekstrak objek berdasarkan alpha channel (transparansi)
  const extractObjectFromAlpha = (src) => {
    const dst = new cv.Mat();
    const channels = new cv.MatVector();
    
    // Pisahkan channel alpha
    cv.split(src, channels);
    
    // Gunakan channel alpha sebagai mask
    const alpha = channels.get(3);
    
    // Buat mask dari alpha channel
    const mask = new cv.Mat();
    cv.threshold(alpha, mask, 10, 255, cv.THRESH_BINARY);
    
    // Temukan kontur dari mask
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    // Hapus mat yang tidak digunakan
    alpha.delete();
    mask.delete();
    channels.delete();
    
    return { contours, hierarchy };
  };

  // Fungsi untuk mendeteksi objek berdasarkan edge detection
  const detectObjectsByEdges = (gray) => {
    const edges = new cv.Mat();
    const blurred = new cv.Mat();
    
    // Blur untuk mengurangi noise
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    
    // Deteksi edge dengan Canny
    cv.Canny(blurred, edges, 50, 150);
    
    // Temukan kontur
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    // Hapus mat yang tidak digunakan
    edges.delete();
    blurred.delete();
    
    return { contours, hierarchy };
  };

  const processImageAutomatically = () => {
    if (!imgSrc) return;

    const img = new Image();
    img.src = imgSrc;

    img.onload = () => {
      try {
        const canvas = previewCanvasRef.current;
        const ctx = canvas.getContext("2d");

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);

        if (typeof cv === "undefined") {
          throw new Error(
            "OpenCV.js belum dimuat. Harap tunggu atau refresh halaman."
          );
        }

        let src = cv.imread(canvas);
        let gray = new cv.Mat();
        let thresh = new cv.Mat();
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        
        // Simpan step-by-step proses OpenCV
        const opencvSteps = ["1. Membaca gambar dari canvas"];
        
        // Analisis apakah gambar memiliki alpha channel (transparansi)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let hasTransparency = false;
        
        for (let i = 3; i < imageData.data.length; i += 4) {
          if (imageData.data[i] < 255) {
            hasTransparency = true;
            break;
          }
        }
        
        let totalArea = 0;
        const contourDetails = [];
        
        if (hasTransparency && detectionMethod !== "manual_threshold") {
          // Gunakan alpha channel untuk mendeteksi objek
          opencvSteps.push("2. Mendeteksi transparansi (alpha channel)");
          opencvSteps.push("3. Mengekstrak objek dari background transparan");
          
          const result = extractObjectFromAlpha(src);
          contours = result.contours;
          hierarchy = result.hierarchy;
        } else {
          // Konversi ke grayscale
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
          opencvSteps.push("2. Konversi ke grayscale");
          
          if (detectionMethod === "manual_threshold") {
            // Gunakan threshold manual
            cv.threshold(gray, thresh, manualThreshold, 255, cv.THRESH_BINARY);
            opencvSteps.push(`3. Threshold manual (${manualThreshold})`);
          } else if (detectionMethod === "edge_based") {
            // Deteksi edge-based
            opencvSteps.push("3. Deteksi tepi dengan algoritma Canny");
            const result = detectObjectsByEdges(gray);
            contours = result.contours;
            hierarchy = result.hierarchy;
          } else {
            // Threshold otomatis dengan Otsu
            cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
            opencvSteps.push("3. Threshold otomatis dengan metode Otsu");
          }
          
          if (detectionMethod !== "edge_based") {
            opencvSteps.push("4. Mencari kontur dari hasil threshold");
            cv.findContours(
              thresh,
              contours,
              hierarchy,
              cv.RETR_EXTERNAL,
              cv.CHAIN_APPROX_SIMPLE
            );
          }
        }
        
        // Filter kontur berdasarkan area minimum (menghilangkan noise)
        const minArea = (canvas.width * canvas.height) * 0.001; // 0.1% dari total area
        const validContours = [];
        
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);
          
          if (area > minArea) {
            validContours.push({
              contour: cnt,
              area: area,
              index: i
            });
          }
        }
        
        // Sort kontur berdasarkan area (terbesar ke terkecil)
        validContours.sort((a, b) => b.area - a.area);
        
        // Gambar semua kontur yang valid dengan warna berbeda
        const colors = [
          new cv.Scalar(255, 0, 0, 255),    // Biru
          new cv.Scalar(0, 255, 0, 255),    // Hijau
          new cv.Scalar(0, 0, 255, 255),    // Merah
          new cv.Scalar(255, 255, 0, 255),  // Cyan
          new cv.Scalar(255, 0, 255, 255),  // Magenta
          new cv.Scalar(0, 255, 255, 255),  // Kuning
        ];
        
        // Reset detected objects
        const objects = [];
        
        // Gambar kontur dan hitung luas
        for (let i = 0; i < Math.min(validContours.length, 6); i++) {
          const validContour = validContours[i];
          const color = colors[i % colors.length];
          
          cv.drawContours(src, contours, validContour.index, color, 3);
          
          // Tambahkan label area
          const moment = cv.moments(validContour.contour);
          const cx = moment.m10 / moment.m00;
          const cy = moment.m01 / moment.m00;
          
          if (!isNaN(cx) && !isNaN(cy)) {
            const label = `Objek ${i + 1}: ${formatNumberWithDecimal(validContour.area, 2)} px²`;
            cv.putText(
              src,
              label,
              new cv.Point(cx - 100, cy),
              cv.FONT_HERSHEY_SIMPLEX,
              0.7,
              color,
              2
            );
          }
          
          totalArea += validContour.area;
          contourDetails.push({
            contour: i + 1,
            area: validContour.area,
            areaFormatted: formatNumberWithDecimal(validContour.area, 2),
            color: `rgb(${color[0]}, ${color[1]}, ${color[2]})`
          });
          
          objects.push({
            index: i,
            area: validContour.area,
            color: colors[i],
            selected: i === 0
          });
        }
        
        setDetectedObjects(objects);
        
        // Jika tidak ada kontur yang valid, coba metode alternatif
        if (validContours.length === 0 && detectionMethod === "automatic") {
          opencvSteps.push("5. Tidak ada objek terdeteksi, mencoba metode edge detection");
          
          const result = detectObjectsByEdges(gray);
          const edgeContours = result.contours;
          const edgeHierarchy = result.hierarchy;
          
          // Gambar kontur dari edge detection
          for (let i = 0; i < edgeContours.size(); i++) {
            const cnt = edgeContours.get(i);
            const area = cv.contourArea(cnt);
            
            if (area > minArea) {
              cv.drawContours(src, edgeContours, i, new cv.Scalar(255, 0, 0, 255), 3);
              totalArea += area;
              contourDetails.push({
                contour: i + 1,
                area: area,
                areaFormatted: formatNumberWithDecimal(area, 2),
                color: "rgb(255, 0, 0)"
              });
            }
          }
          
          edgeContours.delete();
          edgeHierarchy.delete();
        }

        setAreaPixel(totalArea);

        const processedCanvas = processedCanvasRef.current;
        processedCanvas.width = canvas.width;
        processedCanvas.height = canvas.height;

        cv.imshow(processedCanvas, src);
        setProcessedImg(processedCanvas.toDataURL("image/png"));

        // Generate OpenCV calculation details
        const opencvCalculation =
          `**Proses Deteksi Objek:**\n${opencvSteps.join("\n")}\n\n` +
          `**Metode Deteksi:** ${detectionMethod === "automatic" ? "Otomatis (Alpha/Edge)" : detectionMethod === "manual_threshold" ? "Threshold Manual" : "Edge Detection"}\n\n` +
          `**Detail Objek Terdeteksi:**\n${contourDetails
            .map((c) => `Objek ${c.contour}: ${c.areaFormatted} pixel²`)
            .join("\n")}\n\n` +
          `**Total Luas Semua Objek:** ${formatNumberWithDecimal(totalArea, 2)} pixel²\n` +
          `**Jumlah Objek:** ${contourDetails.length}`;

        // Tambahkan step OpenCV ke calculation steps
        if (calculationSteps.length > 0) {
          const opencvStep = {
            step: 0,
            title: "Proses Deteksi Objek - OpenCV",
            description:
              "Analisis bagaimana OpenCV memisahkan objek dari background.",
            formula: "Deteksi kontur berdasarkan alpha channel, threshold, atau edge",
            calculation: opencvCalculation,
            explanation:
              "OpenCV menggunakan berbagai metode untuk mendeteksi batas objek dan menghitung luasnya secara akurat.",
          };

          // Insert OpenCV step at the beginning
          setCalculationSteps((prev) => [opencvStep, ...prev]);
        }

        src.delete();
        if (gray && !gray.isDeleted) gray.delete();
        if (thresh && !thresh.isDeleted) thresh.delete();
        if (contours && !contours.isDeleted) contours.delete();
        if (hierarchy && !hierarchy.isDeleted) hierarchy.delete();

        setIsProcessing(false);
        setError("");

        setShowRiemannControls(true);

        setTimeout(() => {
          generateRiemannData(totalArea);
          setShowRiemannGraph(true);
        }, 100);
      } catch (err) {
        console.error("Error processing image:", err);
        setError(`Gagal memproses gambar: ${err.message}`);
        setIsProcessing(false);
        setShowRiemannControls(false);
      }
    };

    img.onerror = () => {
      setError("Gagal memuat gambar PNG. Pastikan file valid.");
      setIsProcessing(false);
      setShowRiemannControls(false);
    };
  };

  const generateRiemannData = useCallback(
    (area, intervals = riemannIntervals) => {
      // ... (kode generateRiemannData tetap sama seperti sebelumnya)
      // [Kode ini panjang, tetap pertahankan seperti yang ada]
    },
    [riemannMethod, riemannIntervals, formatNumberWithDecimal]
  );

  // ... (fungsi-fungsi lainnya tetap sama seperti sebelumnya)
  // [Kode drawRiemannVisualization, downloadImage, downloadData, useEffect lainnya]

  const handleDeleteImage = () => {
    setImgSrc(null);
    setProcessedImg(null);
    setAreaPixel(0);
    setRiemannData(null);
    setShowRiemannGraph(false);
    setShowRiemannControls(false);
    setMathExplanation("");
    setCalculationSteps([]);
    setCalculationHistory([]);
    setShowStepByStep(true);
    setCurrentStep(0);
    setDetectedObjects([]);
    setSelectedObjectIndex(0);
    setShowDetectionControls(false);
  };

  const reprocessWithMethod = (method) => {
    setDetectionMethod(method);
    setIsProcessing(true);
    setProcessedImg(null);
    setAreaPixel(0);
    setRiemannData(null);
    setShowRiemannGraph(false);
    
    // Delay sedikit untuk memastikan state sudah update
    setTimeout(() => {
      processImageAutomatically();
    }, 100);
  };

  const selectObject = (index) => {
    setSelectedObjectIndex(index);
    // Di sini Anda bisa menambahkan logika untuk menampilkan hanya objek yang dipilih
    // atau menghitung luas hanya untuk objek tersebut
  };

  // Render komponen UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Visualisasi Integral & Pengukur Luas Otomatis
          </h1>
          <p className="text-gray-600 text-lg mt-3">
            Unggah gambar PNG → Deteksi objek otomatis → Hitung luas → Visualisasi Riemann
          </p>
          <p className="text-sm text-gray-500 mt-2">
            ✨ Sekarang mendukung gambar dengan background!
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <div className="flex items-center">
              <span className="mr-2">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Controls untuk metode deteksi */}
        {showDetectionControls && !isProcessing && imgSrc && (
          <div className="mb-6 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl shadow-lg border border-amber-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">🔍</span> Pengaturan Deteksi Objek
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <button
                onClick={() => reprocessWithMethod("automatic")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  detectionMethod === "automatic"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="font-bold text-gray-800 mb-1">Otomatis</div>
                <div className="text-sm text-gray-600">
                  Deteksi berdasarkan transparansi atau edge
                </div>
                <div className="mt-2 text-xs text-blue-600">
                  Direkomendasikan
                </div>
              </button>
              
              <button
                onClick={() => reprocessWithMethod("manual_threshold")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  detectionMethod === "manual_threshold"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="font-bold text-gray-800 mb-1">Threshold Manual</div>
                <div className="text-sm text-gray-600">
                  Kontrol manual threshold value
                </div>
                {detectionMethod === "manual_threshold" && (
                  <div className="mt-3">
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={manualThreshold}
                      onChange={(e) => setManualThreshold(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="text-center text-sm font-medium">
                      Threshold: {manualThreshold}
                    </div>
                  </div>
                )}
              </button>
              
              <button
                onClick={() => reprocessWithMethod("edge_based")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  detectionMethod === "edge_based"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="font-bold text-gray-800 mb-1">Edge Detection</div>
                <div className="text-sm text-gray-600">
                  Deteksi berdasarkan tepi objek
                </div>
                <div className="mt-2 text-xs text-purple-600">
                  Untuk gambar kompleks
                </div>
              </button>
            </div>
            
            <div className="text-sm text-gray-600">
              <span className="font-medium">Tips:</span> Gunakan metode "Otomatis" untuk gambar dengan transparansi, 
              "Manual" untuk kontrol penuh, atau "Edge" untuk gambar dengan gradasi halus.
            </div>
          </div>
        )}

        {/* Tampilkan informasi objek yang terdeteksi */}
        {detectedObjects.length > 0 && !isProcessing && (
          <div className="mb-6 p-4 bg-white rounded-xl shadow border border-gray-200">
            <h4 className="font-bold text-gray-800 mb-3">Objek Terdeteksi</h4>
            <div className="flex flex-wrap gap-3">
              {detectedObjects.map((obj, index) => (
                <button
                  key={index}
                  onClick={() => selectObject(index)}
                  className={`px-4 py-2 rounded-lg flex items-center ${
                    selectedObjectIndex === index
                      ? "bg-blue-100 border-2 border-blue-500"
                      : "bg-gray-100 border border-gray-300"
                  }`}
                >
                  <div 
                    className="w-4 h-4 rounded-full mr-2"
                    style={{ 
                      backgroundColor: `rgb(${obj.color[0]}, ${obj.color[1]}, ${obj.color[2]})` 
                    }}
                  ></div>
                  <span>Objek {index + 1}</span>
                  <span className="ml-2 text-sm text-gray-600">
                    ({formatNumber(obj.area)} px²)
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 text-sm text-gray-600">
              Total: {detectedObjects.length} objek • Klik untuk fokus perhitungan
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Kiri Panel - Upload dan Kontrol */}
          <div className="space-y-8">
            {/* Upload Box - Sama seperti sebelumnya */}
            <div
              {...getRootProps()}
              className={`border-3 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl relative
              ${
                isDragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-blue-300 hover:border-blue-500 hover:bg-blue-50"
              } ${isProcessing ? "opacity-70 cursor-wait" : ""}`}
            >
              <input {...getInputProps()} disabled={isProcessing} />
              
              {isProcessing ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-2xl">
                  <div className="text-5xl mb-4">⏳</div>
                  <p className="text-xl font-semibold text-gray-700">
                    Memproses Gambar...
                  </p>
                  <p className="text-gray-500 mt-2">
                    Mendeteksi objek dan menghitung luas
                  </p>
                  <div className="mt-4 w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-5xl mb-4">{imgSrc ? "🔄" : "📁"}</div>
                  <p className="text-xl font-semibold text-gray-700">
                    {isDragActive
                      ? "Lepaskan gambar di sini..."
                      : imgSrc
                      ? "Ganti Gambar"
                      : "Unggah Gambar PNG"}
                  </p>
                  <p className="text-gray-500 mt-2">
                    Sekarang mendukung gambar dengan background!
                  </p>
                  {imgSrc ? (
                    <div className="mt-4 text-sm text-blue-600">
                      ⚡ Deteksi otomatis objek dari background
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-blue-600">
                      ⚡ PNG dengan atau tanpa background
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Original Image - Sama seperti sebelumnya */}
            {imgSrc && (
              <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Gambar Asli
                  </h2>
                  {isProcessing ? (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center">
                      <svg
                        className="animate-spin h-4 w-4 mr-2"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Memproses...
                    </span>
                  ) : (
                    <button
                      onClick={handleDeleteImage}
                      className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-medium hover:bg-red-100 transition-colors flex items-center"
                    >
                      <span className="mr-1">🗑️</span>
                      Hapus Gambar
                    </button>
                  )}
                </div>

                <div className="relative rounded-xl overflow-hidden border border-gray-300">
                  <img
                    src={imgSrc}
                    className="w-full max-h-72 object-contain"
                    alt="Gambar asli"
                  />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="text-white text-center">
                        <div className="text-3xl mb-2">🔍</div>
                        <p className="font-medium">Mendeteksi objek...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                    PNG
                  </div>
                  {!isProcessing && detectedObjects.length > 0 && (
                    <div className="absolute bottom-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
                      {detectedObjects.length} objek terdeteksi
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ... (bagian lain dari kiri panel tetap sama) ... */}
            
          </div>

          {/* Kanan Panel - Hasil dan Visualisasi */}
          <div className="space-y-8">
            {/* ... (bagian kanan panel tetap sama seperti sebelumnya) ... */}
          </div>
        </div>

        {/* Canvas tersembunyi */}
        <canvas ref={previewCanvasRef} className="hidden"></canvas>
        <canvas ref={processedCanvasRef} className="hidden"></canvas>
        <canvas ref={riemannCanvasRef} className="hidden"></canvas>
        <canvas ref={histogramCanvasRef} className="hidden"></canvas>

        <div className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>✨ Aplikasi Pengukur Luas Otomatis dengan Deteksi Objek & Integral Riemann</p>
          <p className="mt-1">Sekarang mendukung gambar PNG dengan background!</p>
          <a className="mt-2 block" href="https://farrassyuja.my.id/">
            Farras Syuja
          </a>
        </div>
      </div>
    </div>
  );
}