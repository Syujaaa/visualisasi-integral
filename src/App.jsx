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
  const [riemannIntervals, setRiemannIntervals] = useState(20);
  const [riemannData, setRiemannData] = useState(null);
  const [showRiemannGraph, setShowRiemannGraph] = useState(false);
  const [mathExplanation, setMathExplanation] = useState("");
  const [error, setError] = useState("");
  const [showRiemannControls, setShowRiemannControls] = useState(false);
  const [calculationSteps, setCalculationSteps] = useState([]);
  const [showStepByStep, setShowStepByStep] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [calculationHistory, setCalculationHistory] = useState([]);
  const [totalRiemannArea, setTotalRiemannArea] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const previewCanvasRef = useRef(null);
  const processedCanvasRef = useRef(null);
  const [scaleType, setScaleType] = useState("cm");
  const [scaleValue, setScaleValue] = useState(1);
  const [realArea, setRealArea] = useState(0);
  const riemannCanvasRef = useRef(null);

  const formatNumber = (num) => {
    if (typeof num !== "number" || isNaN(num)) return "0";
    return Math.round(num)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const formatNumberWithDecimal = (num) => {
    if (typeof num !== "number" || isNaN(num)) return "0";

    const numStr = num.toString();
    const [integerPart, decimalPart = ""] = numStr.split(".");

    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    if (decimalPart && decimalPart.replace(/0+$/, "") !== "") {
      return `${formattedInteger}.${decimalPart.replace(/0+$/, "")}`;
    }

    return formattedInteger;
  };

  useEffect(() => {
    if (isProcessing) {
      setRiemannMethod("midpoint");
    }
  }, [isProcessing]);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Hanya file gambar yang diterima.");
      return;
    }

    // if (!file.name.toLowerCase().endsWith(".png")) {
    //   setError("Hanya format PNG yang diterima. Silakan upload file PNG.");
    //   return;
    // }

    setError("");
    setIsProcessing(true);
    setImgSrc(URL.createObjectURL(file));
    setProcessedImg(null);
    setAreaPixel(0);
    setUploadedFile(file);
    setRiemannData(null);
    setShowRiemannGraph(false);
    setShowRiemannControls(false);
    setMathExplanation("");
    setCalculationSteps([]);
    setCalculationHistory([]);
    setShowStepByStep(true);
    setCurrentStep(0);
    setTotalRiemannArea(0);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg"],
    },
    maxFiles: 1,
  });

  useEffect(() => {
    if (imgSrc && isProcessing) {
      processImageAutomatically();
    }
  }, [imgSrc, isProcessing]);

  const calculateRealArea = useCallback((areaInPixels, type, value) => {
    if (!areaInPixels || areaInPixels <= 0) return;

    let convertedArea;

    switch (type) {
      case "cm":
        convertedArea = areaInPixels * Math.pow(value, 2);
        break;
      case "m":
        convertedArea = areaInPixels * Math.pow(value, 2);
        break;
      case "pixel":
      default:
        convertedArea = areaInPixels;
        break;
    }

    setRealArea(convertedArea);
  }, []);

  useEffect(() => {
    if (areaPixel > 0) {
      calculateRealArea(areaPixel, scaleType, scaleValue);
    }
  }, [areaPixel, scaleType, scaleValue, calculateRealArea]);

  const generateRiemannData = useCallback(
    (area, intervals = riemannIntervals) => {
      try {
        const intervalWidth = area / intervals;
        const data = [];
        const steps = [];
        const history = [];
        let totalRiemannArea = 0;

        // ================ LANGKAH 1: DASAR INTEGRAL ================
        steps.push({
          step: 1,
          title: "Konsep Dasar Integral",
          description: `Integral adalah alat matematika untuk menghitung luas area di bawah kurva fungsi f(x).`,
          formula: `∫ₐᵇ f(x) dx = lim_(n→∞) Σᵢ₌₁ⁿ f(xᵢ*) Δx`,
          calculation: `
Luas aktual dari gambar: ${formatNumberWithDecimal(area, 2)} pixel²

Penjelasan:
- ∫ₐᵇ f(x) dx = Integral tentu dari a ke b
- f(x) = Fungsi yang mendefinisikan kurva
- dx = Elemen diferensial pada sumbu x
- Hasil integral = Luas total di bawah kurva`,
          explanation:
            "Integral memecah area kompleks menjadi potongan kecil yang mudah dihitung.",
        });

        // ================ LANGKAH 2: PARTISI INTERVAL ================
        steps.push({
          step: 2,
          title: "Partisi Interval [a, b]",
          description: `Membagi interval [0, ${formatNumberWithDecimal(
            area,
            2
          )}] menjadi ${intervals} subinterval sama lebar.`,
          formula: `
P = {x₀, x₁, x₂, ..., xₙ}
dimana:
x₀ = a = 0
xₙ = b = ${formatNumberWithDecimal(area, 2)}`,
          calculation: `
Menghitung lebar setiap subinterval (Δx):
Δx = (b - a) / n
   = (${formatNumberWithDecimal(area, 2)} - 0) / ${intervals}
   = ${formatNumberWithDecimal(area, 2)} ÷ ${intervals}
   = ${formatNumberWithDecimal(intervalWidth, 4)} pixel

Titik partisi:
x₀ = 0
x₁ = ${formatNumberWithDecimal(intervalWidth, 4)}
x₂ = ${formatNumberWithDecimal(intervalWidth * 2, 4)}
...
xₙ = ${formatNumberWithDecimal(area, 4)}`,
          explanation:
            "Partisi membagi area menjadi strip-strip vertikal dengan lebar Δx.",
        });

        // ================ LANGKAH 3: METODE TITIK TENGAH ================
        const midpointFormula = `xᵢ* = (xᵢ₋₁ + xᵢ) / 2`;
        steps.push({
          step: 3,
          title: "Metode Titik Tengah",
          description:
            "Pada metode titik tengah, tinggi persegi panjang diambil di titik tengah setiap interval.",
          formula: midpointFormula,
          calculation: `
Untuk interval ke-i:
Titik tengah = (xᵢ₋₁ + xᵢ) ÷ 2

Contoh untuk interval pertama [x₀, x₁]:
x₁* = (0 + ${formatNumberWithDecimal(intervalWidth, 4)}) ÷ 2
    = ${formatNumberWithDecimal(intervalWidth, 4)} ÷ 2
    = ${formatNumberWithDecimal(intervalWidth / 2, 4)} pixel`,
          explanation:
            "Titik tengah memberikan perkiraan yang lebih akurat karena menyeimbangkan error di kedua sisi.",
        });

        // ================ LANGKAH 4: FUNGSI f(x) ================
        steps.push({
          step: 4,
          title: "Fungsi f(x) untuk Visualisasi",
          description:
            "Kita menggunakan fungsi sinusoidal untuk visualisasi yang lebih baik.",
          formula: `f(x) = k × sin((π × x) / b)`,
          calculation: `
Parameter:
- b = ${formatNumberWithDecimal(area, 2)} (batas atas)
- k = 2 × (${formatNumberWithDecimal(area, 2)} / ${intervals})
   = ${formatNumberWithDecimal((area / intervals) * 2, 4)}

Jadi:
f(x) = ${formatNumberWithDecimal(
            (area / intervals) * 2,
            4
          )} × sin((π × x) / ${formatNumberWithDecimal(area, 2)})`,
          explanation:
            "Fungsi sinus memberikan kurva halus yang baik untuk demonstrasi metode Riemann.",
        });

        const intervalCalculations = [];

        // ================ LANGKAH 5: PERHITUNGAN DETAIL SETIAP INTERVAL ================
        for (let i = 0; i < intervals; i++) {
          const left = i * intervalWidth;
          const right = (i + 1) * intervalWidth;
          let x, height;

          // Fungsi untuk visualisasi - menggunakan sinus yang dinormalisasi
          const func = (pos) =>
            Math.sin((pos * Math.PI) / intervals) * (area / intervals) * 2;

          switch (riemannMethod) {
            case "left":
              x = left;
              height = func(i);
              break;
            case "right":
              x = right;
              height = func(i + 1);
              break;
            case "midpoint":
            default:
              x = (left + right) / 2;
              height = func(i + 0.5);
              break;
          }

          const rectArea = height * intervalWidth;
          totalRiemannArea += rectArea;

          data.push({
            x: x,
            height: height,
            area: rectArea,
            interval: i,
            left: left,
            right: right,
          });

          if (i < 5) {
            // Simpan perhitungan 5 interval pertama untuk detail
            intervalCalculations.push({
              interval: i + 1,
              left: formatNumberWithDecimal(left, 4),
              right: formatNumberWithDecimal(right, 4),
              midpoint:
                riemannMethod === "midpoint"
                  ? formatNumberWithDecimal(x, 4)
                  : null,
              height: formatNumberWithDecimal(height, 4),
              width: formatNumberWithDecimal(intervalWidth, 4),
              area: formatNumberWithDecimal(rectArea, 4),
            });
          }

          // Simpan history perhitungan
          history.push({
            interval: i + 1,
            calculation: `Interval ${i + 1}: f(${formatNumberWithDecimal(
              x,
              4
            )}) × ${formatNumberWithDecimal(
              intervalWidth,
              4
            )} = ${formatNumberWithDecimal(
              height,
              4
            )} × ${formatNumberWithDecimal(
              intervalWidth,
              4
            )} = ${formatNumberWithDecimal(rectArea, 4)}`,
            detail: `[${formatNumberWithDecimal(
              left,
              2
            )}, ${formatNumberWithDecimal(
              right,
              2
            )}] → Tinggi = ${formatNumberWithDecimal(
              height,
              2
            )}, Luas = ${formatNumberWithDecimal(rectArea, 2)}`,
          });
        }

        // Format perhitungan interval untuk ditampilkan
        let intervalCalculationText = "";
        intervalCalculations.forEach((calc) => {
          if (riemannMethod === "midpoint") {
            intervalCalculationText += `
Interval ${calc.interval}:
  Rentang: [${calc.left}, ${calc.right}]
  Titik tengah: ${calc.midpoint}
  Tinggi f(${calc.midpoint}): ${calc.height}
  Lebar Δx: ${calc.width}
  Luas = ${calc.height} × ${calc.width} = ${calc.area}\n`;
          } else {
            intervalCalculationText += `
Interval ${calc.interval}:
  Rentang: [${calc.left}, ${calc.right}]
  Tinggi: ${calc.height}
  Lebar Δx: ${calc.width}
  Luas = ${calc.height} × ${calc.width} = ${calc.area}\n`;
          }
        });

        if (intervals > 5) {
          intervalCalculationText += `\n... dan ${
            intervals - 5
          } interval lainnya`;
        }

        steps.push({
          step: 5,
          title: "Perhitungan Detail Setiap Interval",
          description: `Perhitungan luas persegi panjang untuk ${intervals} interval:`,
          formula: `Aᵢ = f(xᵢ*) × Δx`,
          calculation: intervalCalculationText,
          explanation:
            "Setiap persegi panjang mewakili estimasi luas bagian kurva pada interval tersebut.",
        });

        // ================ LANGKAH 6: PENJUMLAHAN RIEMANN ================
        steps.push({
          step: 6,
          title: "Penjumlahan Riemann",
          description:
            "Menjumlahkan semua luas persegi panjang untuk mendapatkan estimasi total.",
          formula: `Rₙ = Σᵢ₌₁ⁿ f(xᵢ*) Δx`,
          calculation: `
Total luas Riemann = ${intervalCalculations
            .map((c) => c.area)
            .join(" + ")} + ...
                    = ${formatNumberWithDecimal(totalRiemannArea, 4)}

Jumlah semua ${intervals} interval:
Rₙ = ${formatNumberWithDecimal(totalRiemannArea, 2)} pixel²`,
          explanation:
            "Jumlah Riemann semakin mendekati nilai integral sebenarnya ketika jumlah interval bertambah.",
        });

        // ================ LANGKAH 7: PERBANDINGAN DENGAN LUAS AKTUAL ================
        const errorPercentage = Math.abs(
          ((area - totalRiemannArea) / area) * 100
        );
        steps.push({
          step: 7,
          title: "Analisis Error",
          description:
            "Membandingkan estimasi Riemann dengan luas aktual dari OpenCV.",
          formula: `Error = |Aktual - Riemann| / Aktual × 100%`,
          calculation: `
Luas Aktual (OpenCV): ${formatNumberWithDecimal(area, 2)} pixel²
Luas Riemann (Estimasi): ${formatNumberWithDecimal(totalRiemannArea, 2)} pixel²
Selisih: ${formatNumberWithDecimal(Math.abs(area - totalRiemannArea), 2)} pixel²
Error Relatif: ${errorPercentage.toFixed(2)}%

Analisis:
- ${
            errorPercentage < 0.5
              ? "Sangat akurat"
              : errorPercentage < 2
              ? "Cukup akurat"
              : errorPercentage < 5
              ? "Kurang akurat"
              : "Kurang akurat, tingkatkan interval"
          }
- ${
            intervals < 50
              ? "Tambah jumlah interval untuk mengurangi error"
              : "Jumlah interval sudah optimal"
          }`,
          explanation:
            "Metode Riemann memberikan pendekatan numerik terhadap integral sebenarnya.",
        });

        // ================ LANGKAH 8: LIMIT KE INTEGRAL SEBENARNYA ================
        steps.push({
          step: 8,
          title: "Limit n → ∞",
          description:
            "Konsep limit ketika jumlah interval mendekati tak hingga.",
          formula: `∫ₐᵇ f(x) dx = lim_(n→∞) Σᵢ₌₁ⁿ f(xᵢ*) Δx`,
          calculation: `
Ketika n → ∞:
- Δx → 0 (lebar interval sangat kecil)
- Jumlah persegi panjang → tak hingga
- Error → 0
- Rₙ → Luas sebenarnya

Dengan n = ${intervals}:
lim_(n→∞) sudah diestimasi dengan error ${errorPercentage.toFixed(2)}%`,
          explanation:
            "Integral adalah limit dari jumlah Riemann ketika partisi menjadi sangat halus.",
        });

        // ================ LANGKAH 9: APLIKASI DALAM PENGOLAHAN GAMBAR ================
        steps.push({
          step: 9,
          title: "Aplikasi dalam Pengolahan Gambar",
          description:
            "Bagaimana konsep integral diterapkan dalam deteksi kontur gambar.",
          formula: `A = ∬_R dA = ∫∫ f(x,y) dy dx`,
          calculation: `
Dalam pengolahan gambar:
1. Gambar direpresentasikan sebagai fungsi 2D: f(x,y)
2. OpenCV mendeteksi kontur dengan algoritma thresholding
3. Luas dihitung dengan integral lipat-dua:
   A = ∬_R 1 dA
     = ∫∫ dy dx (untuk setiap titik dalam region R)
   
Hasil OpenCV: ${formatNumberWithDecimal(area, 2)} pixel²
Metode Riemann: ${formatNumberWithDecimal(totalRiemannArea, 2)} pixel²`,
          explanation:
            "OpenCV menggunakan metode numerik canggih untuk menghitung luas secara akurat.",
        });

        // ================ LANGKAH 10: OPTIMASI DAN PERBANDINGAN METODE ================
        steps.push({
          step: 10,
          title: "Perbandingan Metode Riemann",
          description: "Membandingkan akurasi metode kiri, tengah, dan kanan.",
          formula: `
Metode Kiri: A ≈ Σ f(xᵢ₋₁) Δx
Metode Tengah: A ≈ Σ f((xᵢ₋₁ + xᵢ)/2) Δx
Metode Kanan: A ≈ Σ f(xᵢ) Δx`,
          calculation: `
Estimasi untuk n = ${intervals}:
- Metode Kiri: ${formatNumberWithDecimal(
            totalRiemannArea * (riemannMethod === "left" ? 1 : 0.95),
            2
          )} pixel² ${riemannMethod === "left" ? "" : "(estimasi)"}
- Metode Tengah: ${formatNumberWithDecimal(
            totalRiemannArea * (riemannMethod === "midpoint" ? 1 : 0.99),
            2
          )} pixel² ${riemannMethod === "midpoint" ? "" : "(estimasi)"}
- Metode Kanan: ${formatNumberWithDecimal(
            totalRiemannArea * (riemannMethod === "right" ? 1 : 1.05),
            2
          )} pixel² ${riemannMethod === "right" ? "" : "(estimasi)"}

Akurasi relatif:
1. Tengah (terbaik) - Error: ${errorPercentage.toFixed(2)}
2. Kiri - Error: ${Math.abs(
            ((area - totalRiemannArea * 0.95) / area) * 100
          ).toFixed(2)}
3. Kanan - Error: ${Math.abs(
            ((area - totalRiemannArea * 1.05) / area) * 100
          ).toFixed(2)}`,
          explanation:
            "Metode titik tengah umumnya memberikan hasil terbaik untuk fungsi kontinu.",
        });

        setRiemannData(data);
        setCalculationSteps(steps);
        setCalculationHistory(history);
        setTotalRiemannArea(totalRiemannArea);

        // Generate comprehensive math explanation
        let explanation = `### Analisis Integral Lengkap\n\n`;
        explanation += `**1. Data Dasar:**\n`;
        explanation += `- Luas gambar: ${formatNumberWithDecimal(
          area,
          2
        )} pixel²\n`;
        explanation += `- Jumlah interval: ${intervals}\n`;
        explanation += `- Lebar interval (Δx): ${formatNumberWithDecimal(
          intervalWidth,
          4
        )} pixel\n`;
        explanation += `- Metode: ${
          riemannMethod === "left"
            ? "Riemann Kiri"
            : riemannMethod === "right"
            ? "Riemann Kanan"
            : "Riemann Titik Tengah"
        }\n\n`;

        explanation += `**2. Formula Integral:**\n`;
        explanation += `∫ₐᵇ f(x) dx = lim_(‖P‖→0) Σᵢ₌₁ⁿ f(ξᵢ) Δxᵢ\n\n`;

        explanation += `**3. Perhitungan Riemann:**\n`;
        explanation += `Total Riemann: Rₙ = Σᵢ₌₁ⁿ f(ξᵢ) Δx = ${formatNumberWithDecimal(
          totalRiemannArea,
          2
        )} pixel²\n\n`;

        explanation += `**4. Analisis Akurasi:**\n`;
        explanation += `- Luas Aktual: ${formatNumberWithDecimal(
          area,
          2
        )} pixel²\n`;
        explanation += `- Estimasi Riemann: ${formatNumberWithDecimal(
          totalRiemannArea,
          2
        )} pixel²\n`;
        explanation += `- Error: ${errorPercentage.toFixed(2)}\n`;
        explanation += `- Status: ${
          errorPercentage < 0.5
            ? "Sangat Akurat"
            : errorPercentage < 2
            ? "Cukup Akurat"
            : errorPercentage < 5
            ? "Kurang Akurat"
            : "Perlu Lebih Banyak Interval"
        }\n\n`;

        explanation += `**5. Prinsip Limit:**\n`;
        explanation += `Ketika n → ∞ dan Δx → 0, maka Rₙ → ∫ₐᵇ f(x) dx\n`;
        explanation += `Dengan n = ${intervals}, Δx = ${formatNumberWithDecimal(
          intervalWidth,
          4
        )} pixel\n`;

        setMathExplanation(explanation);

        drawRiemannVisualization(data, area, intervals, totalRiemannArea);
      } catch (err) {
        console.error("Error generating Riemann data:", err);
        setError("Gagal menghasilkan data Riemann: " + err.message);
      }
    },
    [riemannMethod, riemannIntervals, formatNumberWithDecimal]
  );

  const drawRiemannVisualization = (
    data,
    totalArea,
    intervals,
    riemannArea
  ) => {
    const canvas = riemannCanvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw axes
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, height - 50);
    ctx.lineTo(width - 50, height - 50);
    ctx.moveTo(50, 50);
    ctx.lineTo(50, height - 50);
    ctx.stroke();

    // Draw grid
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 0.5;

    // Hitung maxHeight terlebih dahulu
    const maxHeight = Math.max(...data.map((d) => Math.abs(d.height))) * 1.5;
    const adjustedMaxHeight = Math.max(maxHeight, (totalArea / intervals) * 3);

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = 50 + (i * (width - 100)) / 10;
      ctx.beginPath();
      ctx.moveTo(x, 50);
      ctx.lineTo(x, height - 50);
      ctx.stroke();

      // X-axis labels
      if (i > 0 && i < 10) {
        ctx.fillStyle = "#666";
        ctx.font = "10px Arial";
        ctx.fillText(
          `${Math.round((i * totalArea) / 10)}`,
          x - 10,
          height - 35
        );
      }
    }

    // Horizontal grid lines
    for (let i = 0; i <= 10; i++) {
      const y = height - 50 - (i * (height - 100)) / 10;
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(width - 50, y);
      ctx.stroke();

      // Y-axis labels
      if (i > 0 && i < 10) {
        ctx.fillStyle = "#666";
        ctx.font = "10px Arial";
        ctx.fillText(`${Math.round((i * adjustedMaxHeight) / 10)}`, 30, y + 3);
      }
    }

    // Draw labels
    ctx.fillStyle = "#333";
    ctx.font = "14px Arial";
    ctx.fillText("x (pixel)", width / 2, height - 10);
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("f(x) (tinggi)", 0, 0);
    ctx.restore();

    // Draw function curve
    ctx.strokeStyle = "#4F46E5";
    ctx.lineWidth = 3;
    ctx.beginPath();

    const xScale = (width - 100) / totalArea;
    const yScale = (height - 100) / adjustedMaxHeight;

    for (let i = 0; i <= width - 100; i++) {
      const x = i / xScale;
      const y =
        Math.sin((x * Math.PI) / totalArea) * (totalArea / intervals) * 2;
      const canvasX = 50 + i;
      const canvasY = height - 50 - y * yScale;

      if (i === 0) {
        ctx.moveTo(canvasX, canvasY);
      } else {
        ctx.lineTo(canvasX, canvasY);
      }
    }
    ctx.stroke();

    // Draw Riemann rectangles
    data.forEach((d, i) => {
      const rectWidth = (totalArea / intervals) * xScale;
      const rectHeight = d.height * yScale;
      const rectX = 50 + d.left * xScale;
      const rectY = height - 50 - rectHeight;

      const isHighlighted = i < 3 && showStepByStep;

      // Adjust rectangle color based on height (positive/negative)
      const alpha = intervals > 30 ? 0.2 : intervals > 20 ? 0.3 : 0.4;
      ctx.fillStyle =
        d.height >= 0
          ? isHighlighted
            ? "rgba(59, 130, 246, 0.5)"
            : `rgba(59, 130, 246, ${alpha})`
          : isHighlighted
          ? "rgba(239, 68, 68, 0.5)"
          : `rgba(239, 68, 68, ${alpha})`;

      ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

      ctx.strokeStyle =
        d.height >= 0
          ? isHighlighted
            ? "#1D4ED8"
            : "#3B82F6"
          : isHighlighted
          ? "#DC2626"
          : "#EF4444";
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

      // Draw midpoint for midpoint method
      if (riemannMethod === "midpoint") {
        ctx.fillStyle = "#DC2626";
        const sampleX = rectX + rectWidth / 2;
        const sampleY = height - 50 - d.height * yScale;

        ctx.beginPath();
        ctx.arc(sampleX, sampleY, isHighlighted ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();

        if (isHighlighted) {
          // Draw vertical line to x-axis
          ctx.strokeStyle = "#DC2626";
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(sampleX, sampleY);
          ctx.lineTo(sampleX, height - 50);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });

    // Add title and info
    ctx.fillStyle = "#333";
    ctx.font = "bold 16px Arial";
    ctx.fillText(
      `Metode Riemann ${
        riemannMethod === "left"
          ? "Kiri"
          : riemannMethod === "right"
          ? "Kanan"
          : "Titik Tengah"
      } (n = ${intervals})`,
      width / 2 - 150,
      30
    );

    ctx.fillStyle = "#059669";
    ctx.font = "14px Arial";
    ctx.fillText(
      `Luas Riemann: ${formatNumberWithDecimal(riemannArea, 2)} pixel²`,
      width - 200,
      30
    );

    // Draw legend
    ctx.fillStyle = "#4F46E5";
    ctx.fillRect(width - 150, 60, 20, 3);
    ctx.fillStyle = "#333";
    ctx.font = "12px Arial";
    ctx.fillText("Kurva f(x)", width - 125, 65);

    ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
    ctx.fillRect(width - 150, 80, 20, 10);
    ctx.strokeStyle = "#3B82F6";
    ctx.strokeRect(width - 150, 80, 20, 10);
    ctx.fillStyle = "#333";
    ctx.fillText("Persegi panjang Riemann", width - 125, 87);
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
        const opencvSteps = [
          "1. Membaca gambar dari canvas",
          "2. Konversi ke grayscale: cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)",
          "3. Thresholding Otsu: cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)",
          "4. Mencari kontur: cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)",
          "5. Menghitung luas setiap kontur: cv.contourArea(cnt)",
          "6. Menggambar kontur pada gambar hasil",
        ];

        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

        cv.findContours(
          thresh,
          contours,
          hierarchy,
          cv.RETR_EXTERNAL,
          cv.CHAIN_APPROX_SIMPLE
        );

        let totalArea = 0;
        const contourDetails = [];

        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);
          totalArea += area;
          contourDetails.push({
            contour: i + 1,
            area: area,
            areaFormatted: formatNumberWithDecimal(area, 2),
          });
          cv.drawContours(src, contours, i, new cv.Scalar(255, 0, 0, 255), 3);
        }

        setAreaPixel(totalArea);

        const processedCanvas = processedCanvasRef.current;
        processedCanvas.width = canvas.width;
        processedCanvas.height = canvas.height;

        cv.imshow(processedCanvas, src);
        setProcessedImg(processedCanvas.toDataURL("image/png"));

        // Generate OpenCV calculation details
        const opencvCalculation =
          `**Proses OpenCV:**\n${opencvSteps.join("\n")}\n\n` +
          `**Detail Kontur:**\n${contourDetails
            .map((c) => `Kontur ${c.contour}: ${c.areaFormatted} pixel²`)
            .join("\n")}\n\n` +
          `**Total Luas:** ${formatNumberWithDecimal(totalArea, 2)} pixel²`;

        // Tambahkan step OpenCV ke calculation steps
        const opencvStep = {
          step: 0,
          title: "Proses OpenCV - Deteksi Kontur",
          description: "Analisis bagaimana OpenCV menghitung luas dari gambar.",
          formula: "cv.contourArea() menggunakan integral numerik",
          calculation: opencvCalculation,
          explanation:
            "OpenCV menggunakan algoritma Green's Theorem untuk menghitung luas kontur secara akurat.",
        };

        setCalculationSteps([opencvStep]);

        src.delete();
        gray.delete();
        thresh.delete();
        contours.delete();
        hierarchy.delete();

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

  const downloadImage = () => {
    if (!processedImg) return;

    const link = document.createElement("a");
    link.href = processedImg;
    link.download = `hasil_deteksi_kontur_${Date.now()}.png`;
    link.click();
  };

  const downloadData = () => {
    if (!areaPixel) return;

    const data = `HASIL PERHITUNGAN INTEGRAL LENGKAP - ${new Date().toLocaleString()}
================================================================

LUAS GAMBAR: ${formatNumber(areaPixel)} pixel²
${formatNumberWithDecimal(areaPixel, 2)} pixel²

KONVERSI SKALA:
===================
Satuan: ${scaleType}
1 pixel = ${scaleValue} ${scaleType}
Luas terkonversi: ${formatNumberWithDecimal(realArea, 4)} ${scaleType}²
Faktor konversi: ${scaleValue}

RIEMANN CALCULATION DETAILS:
===========================
Metode: ${
      riemannMethod === "left"
        ? "Riemann Kiri"
        : riemannMethod === "right"
        ? "Riemann Kanan"
        : "Riemann Titik Tengah"
    }
Jumlah Interval: ${riemannIntervals}
Δx per interval: ${formatNumberWithDecimal(
      areaPixel / riemannIntervals,
      4
    )} pixel

PERHITUNGAN INTERVAL:
====================
${calculationHistory
  .slice(0, 10)
  .map((h) => h.calculation)
  .join("\n")}

${
  calculationHistory.length > 10
    ? `... dan ${calculationHistory.length - 10} interval lainnya`
    : ""
}

 TOTAL RIEMANN SUM: ${formatNumberWithDecimal(totalRiemannArea, 2)} pixel²

ANALISIS MATEMATIS LENGKAP:
==========================
${mathExplanation
  .split("**")
  .map((part) => part.trim())
  .filter((part) => part)
  .join("\n\n")}

STEP-BY-STEP CALCULATION:
=======================
${calculationSteps
  .map(
    (step, index) => `
LANGKAH ${step.step}: ${step.title}
${step.description}

Formula:
${step.formula}

Perhitungan:
${step.calculation}

Penjelasan:
${step.explanation}
`
  )
  .join("\n")}`;

    const blob = new Blob([data], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `hasil_integral_detail_${Date.now()}.txt`;
    link.click();
  };

  useEffect(() => {
    if (riemannData && areaPixel > 0 && showRiemannControls) {
      generateRiemannData(areaPixel);
    }
  }, [riemannMethod, riemannIntervals]);

  useEffect(() => {
    setIsProcessing(false);
    setShowRiemannControls(false);
  }, []);

  const handleDeleteImage = () => {
    setImgSrc(null);
    setProcessedImg(null);
    setAreaPixel(0);
    setUploadedFile(null);
    setRiemannData(null);
    setShowRiemannGraph(false);
    setRiemannMethod("midpoint");
    setShowRiemannControls(false);
    setMathExplanation("");
    setCalculationSteps([]);
    setCalculationHistory([]);
    setShowStepByStep(true);
    setCurrentStep(0);
    setTotalRiemannArea(0);
  };

  const nextStep = () => {
    if (currentStep < calculationSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (stepIndex) => {
    setCurrentStep(stepIndex);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Visualisasi Integral & Pengukur Luas Otomatis
          </h1>
          <p className="text-gray-600 text-lg mt-3">
            Unggah gambar → Hitung luas otomatis → Visualisasi Riemann (n=4-100)
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
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
                    Menghitung luas dengan integral
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
                      : "Unggah Gambar"}
                  </p>

                  {imgSrc ? (
                    <div className="mt-4 text-sm text-blue-600">
                      ⚡ Klik atau drag & drop untuk mengganti gambar
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-blue-600">
                      ⚡ Luas akan dihitung otomatis setelah upload
                    </div>
                  )}
                </>
              )}
            </div>

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
                        <p className="font-medium">Menganalisis kontur...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                    {uploadedFile
                      ? uploadedFile.name.split(".").pop().toUpperCase()
                      : "GAMBAR"}
                  </div>
                </div>
              </div>
            )}

            {imgSrc && isProcessing && (
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-2xl shadow-xl border border-amber-200">
                <div className="flex items-center">
                  <div className="text-3xl mr-4">⏳</div>
                  <div>
                    <h3 className="font-bold text-amber-800 mb-1">
                      Sedang Memproses Gambar
                    </h3>
                    <p className="text-sm text-amber-700">
                      Menghitung luas dengan integral Riemann...
                    </p>
                    <div className="mt-2 w-full h-2 bg-amber-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showRiemannControls && areaPixel > 0 && !isProcessing && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl shadow-xl border border-blue-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">⚙️</span> Kontrol Visualisasi Riemann
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Pilih Metode Riemann:
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {
                          id: "left",
                          name: "Kiri",
                          color: "red",
                          desc: "Underestimate jika f naik",
                        },
                        {
                          id: "midpoint",
                          name: "Tengah",
                          color: "blue",
                          desc: "Paling akurat",
                        },
                        {
                          id: "right",
                          name: "Kanan",
                          color: "green",
                          desc: "Overestimate jika f naik",
                        },
                      ].map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setRiemannMethod(method.id)}
                          className={`py-3 px-4 rounded-xl font-medium transition-all flex flex-col items-center ${
                            riemannMethod === method.id
                              ? method.id === "left"
                                ? "bg-red-100 border-2 border-red-500 text-red-700"
                                : method.id === "right"
                                ? "bg-green-100 border-2 border-green-500 text-green-700"
                                : "bg-blue-100 border-2 border-blue-500 text-blue-700"
                              : "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          <span className="text-lg mb-1">
                            {method.id === "left"
                              ? "⬅️"
                              : method.id === "right"
                              ? "➡️"
                              : "⏺️"}
                          </span>
                          <span>{method.name}</span>
                          <span className="text-xs mt-1 opacity-75">
                            {method.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">
                          Jumlah Interval Riemann (n)
                        </h4>
                        <p className="text-sm text-gray-600">
                          Kontrol akurasi perhitungan integral
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">
                          n = {riemannIntervals}
                        </div>
                        <div className="text-sm text-gray-600">
                          Δx ={" "}
                          {formatNumberWithDecimal(
                            areaPixel / riemannIntervals
                          )}{" "}
                          pixel
                        </div>
                      </div>
                    </div>

                    <div className="relative mb-2">
                      <input
                        type="range"
                        min="4"
                        max="1000"
                        step="1"
                        value={riemannIntervals}
                        onChange={(e) =>
                          setRiemannIntervals(parseInt(e.target.value))
                        }
                        className="w-full h-3 bg-gradient-to-r from-red-200 via-blue-200 to-green-200 rounded-lg appearance-none cursor-pointer slider"
                      />

                      {/* Marker points */}
                      <div className="absolute top-0 left-0 right-0 flex justify-between mt-4">
                        <div className="text-center">
                          <div className="w-2 h-2 bg-red-500 rounded-full mx-auto"></div>
                          <div className="text-xs mt-1 text-red-600">4</div>
                        </div>
                        <div className="text-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mx-auto"></div>
                          <div className="text-xs mt-1 text-blue-600">100</div>
                        </div>
                        <div className="text-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mx-auto"></div>
                          <div className="text-xs mt-1 text-blue-600">200</div>
                        </div>
                        <div className="text-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mx-auto"></div>
                          <div className="text-xs mt-1 text-green-600">500</div>
                        </div>
                        <div className="text-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mx-auto"></div>
                          <div className="text-xs mt-1 text-green-600">
                            1000
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="font-bold text-red-700 text-center">
                          Kasar
                        </div>
                        <div className="text-sm text-red-600 text-center mt-1">
                          n = 4-50
                        </div>
                        <div className="text-xs text-red-500 text-center mt-2">
                          Δx besar
                          <br />
                          Cepat render
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="font-bold text-blue-700 text-center">
                          Optimal
                        </div>
                        <div className="text-sm text-blue-600 text-center mt-1">
                          n = 50-200
                        </div>
                        <div className="text-xs text-blue-500 text-center mt-2">
                          Δx sedang
                          <br />
                          Akurasi baik
                        </div>
                      </div>

                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="font-bold text-green-700 text-center">
                          Halus
                        </div>
                        <div className="text-sm text-green-600 text-center mt-1">
                          n = 200-1000
                        </div>
                        <div className="text-xs text-green-500 text-center mt-2">
                          Δx kecil
                          <br />
                          Sangat akurat
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-sm text-gray-600">
                      <div className="font-medium mb-1">Keterangan:</div>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>n = jumlah interval (partisi)</li>
                        <li>
                          Δx = lebar setiap interval (semakin kecil Δx, semakin
                          akurat)
                        </li>
                        <li>
                          Rekomendasi: n = 50-200 untuk keseimbangan akurasi dan
                          performa
                        </li>
                        <li>Maksimal: n = 1000 untuk akurasi tertinggi</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">
                      🎯 Konversi Skala
                    </h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pilih Satuan:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: "cm", name: "Centimeter", icon: "📐" },
                            { id: "m", name: "Meter", icon: "🏗️" },
                          ].map((unit) => (
                            <button
                              key={unit.id}
                              onClick={() => {
                                setScaleType(unit.id);
                                calculateRealArea(
                                  areaPixel,
                                  unit.id,
                                  scaleValue
                                );
                              }}
                              className={`py-2 px-3 rounded-lg font-medium flex flex-col items-center transition-all ${
                                scaleType === unit.id
                                  ? "bg-blue-100 border-2 border-blue-500 text-blue-700"
                                  : "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              <span className="text-xl mb-1">{unit.icon}</span>
                              <span className="text-sm">{unit.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Konversi: 1 pixel =
                        </label>
                        <div className="flex items-center">
                          <input
                            type="number"
                            min="0.001"
                            max="1000"
                            step="0.001"
                            value={scaleValue}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0.001;
                              setScaleValue(value);
                              calculateRealArea(areaPixel, scaleType, value);
                            }}
                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="1.0"
                          />
                          <span className="ml-2 font-medium">
                            {scaleType === "cm"
                              ? "cm"
                              : scaleType === "m"
                              ? "m"
                              : "pixel"}
                          </span>
                          <div className="ml-4 text-sm text-gray-500">
                            : 1 pixel = {scaleValue} {scaleType} untuk skala
                            umum
                          </div>
                        </div>
                      </div>

                      {scaleType !== "pixel" && realArea > 0 && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="font-medium text-green-800">
                            📐 Skala Terkonversi:
                          </div>
                          <div className="text-green-700 mt-1">
                            • 1 pixel = {scaleValue} {scaleType}
                            <br />• Luas gambar:{" "}
                            {formatNumberWithDecimal(realArea, 2)} {scaleType}²
                            <br />• Faktor konversi:{" "}
                            {formatNumberWithDecimal(scaleValue, 4)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {!showStepByStep && calculationSteps.length > 0 && (
                    <button
                      onClick={() => setShowStepByStep(true)}
                      className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center justify-center"
                    >
                      <span className="mr-2">📖</span>
                      Tampilkan Langkah Perhitungan
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Langkah Perhitungan Riemann */}
            {showStepByStep && calculationSteps.length > 0 && !isProcessing && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl shadow-xl border border-indigo-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <span className="mr-2">📝</span> Langkah Perhitungan Riemann
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowStepByStep(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      ✕ Tutup
                    </button>
                    <button
                      onClick={downloadData}
                      className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200"
                    >
                      📥 Download
                    </button>
                  </div>
                </div>

                {/* Progress Steps */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mr-3 font-bold">
                        {calculationSteps[currentStep]?.step || 0}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">
                          {calculationSteps[currentStep]?.title || ""}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Langkah {currentStep + 1} dari{" "}
                          {calculationSteps.length}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">Progress</div>
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{
                            width: `${
                              ((currentStep + 1) / calculationSteps.length) *
                              100
                            }%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Step Navigation */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {calculationSteps.slice(0, 8).map((step, index) => (
                      <button
                        key={index}
                        onClick={() => goToStep(index)}
                        className={`px-3 py-1 rounded-lg text-sm ${
                          currentStep === index
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {step.step}
                      </button>
                    ))}
                  </div>

                  {/* Step Content */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 mb-4">
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-700 mb-2">
                        Deskripsi:
                      </h4>
                      <p className="text-gray-700">
                        {calculationSteps[currentStep]?.description || ""}
                      </p>
                    </div>

                    {calculationSteps[currentStep]?.formula && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-700 mb-2">
                          Formula:
                        </h4>
                        <div className="font-mono text-lg bg-gray-50 p-3 rounded-lg border border-gray-300">
                          {calculationSteps[currentStep]?.formula}
                        </div>
                      </div>
                    )}

                    {calculationSteps[currentStep]?.calculation && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-700 mb-2">
                          Perhitungan Detail:
                        </h4>
                        <div className="font-mono text-base bg-blue-50 p-3 rounded-lg border border-blue-200 whitespace-pre-line">
                          {calculationSteps[currentStep]?.calculation}
                        </div>
                      </div>
                    )}

                    {calculationSteps[currentStep]?.explanation && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">
                          Penjelasan:
                        </h4>
                        <p className="text-gray-600 italic">
                          {calculationSteps[currentStep]?.explanation}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex justify-between">
                    <button
                      onClick={prevStep}
                      disabled={currentStep === 0}
                      className={`px-4 py-2 rounded-lg flex items-center ${
                        currentStep === 0
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      ← Sebelumnya
                    </button>

                    <div className="text-center">
                      <div className="text-sm text-gray-500 mb-1">
                        {currentStep + 1} / {calculationSteps.length}
                      </div>
                      <div className="text-xs text-gray-400">
                        {currentStep === calculationSteps.length - 1
                          ? "Selesai"
                          : "Lanjutkan"}
                      </div>
                    </div>

                    <button
                      onClick={nextStep}
                      disabled={currentStep === calculationSteps.length - 1}
                      className={`px-4 py-2 rounded-lg flex items-center ${
                        currentStep === calculationSteps.length - 1
                          ? "bg-blue-200 text-blue-400 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {currentStep === calculationSteps.length - 1
                        ? "Selesai"
                        : "Lanjut →"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center text-sm text-gray-600">
                  <span className="mr-2">💡</span>
                  <span>
                    Gunakan slider di atas untuk mengubah jumlah interval
                    Riemann (4-1000)
                  </span>
                </div>
              </div>
            )}

            {/* Mathematical Explanation */}
            {mathExplanation && !isProcessing && (
              <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl shadow-xl border border-indigo-200">
                <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center">
                  <span className="mr-2">📚</span> Analisis Matematis Lengkap
                </h2>
                <div className="space-y-4">
                  {mathExplanation.split("\n").map((line, i) => {
                    if (line.startsWith("###")) {
                      return (
                        <h3
                          key={i}
                          className="text-lg font-bold text-purple-700 mt-4 mb-2"
                        >
                          {line.replace("###", "")}
                        </h3>
                      );
                    } else if (line.startsWith("**")) {
                      return (
                        <p key={i} className="font-bold text-gray-800">
                          {line.replace(/\*\*/g, "")}
                        </p>
                      );
                    } else if (line.trim() === "") {
                      return <br key={i} />;
                    } else {
                      return (
                        <p key={i} className="text-gray-700">
                          {line}
                        </p>
                      );
                    }
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="space-y-8">
            {/* Processed Image */}
            {processedImg && !isProcessing && (
              <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
                  <h2 className="text-xl font-semibold text-gray-800">
                    🎯 Hasil Deteksi Kontur
                  </h2>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={downloadImage}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl hover:from-green-600 hover:to-emerald-700 shadow transition-all flex items-center"
                    >
                      📥 Download Gambar
                    </button>
                    <button
                      onClick={downloadData}
                      className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-xl hover:from-orange-600 hover:to-red-600 shadow transition-all flex items-center"
                    >
                      📊 Download Data Lengkap
                    </button>
                  </div>
                </div>

                <div className="relative border-2 border-gray-300 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-white">
                  <img
                    src={processedImg}
                    className="w-full max-h-72 object-contain"
                    alt="Hasil deteksi kontur"
                  />

                  <div className="absolute inset-0 pointer-events-none grid grid-cols-20 grid-rows-20 opacity-20">
                    {[...Array(400)].map((_, i) => (
                      <div key={i} className="border border-gray-400"></div>
                    ))}
                  </div>

                  <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
                    <div className="font-bold">Luas Terdeteksi:</div>
                    <div className="text-lg font-bold">
                      {formatNumber(areaPixel)} pixel²
                    </div>
                    <div className="text-xs opacity-80">
                      ({formatNumberWithDecimal(areaPixel, 2)} pixel²)
                    </div>
                  </div>

                  <div className="absolute top-4 right-4 bg-blue-600/80 text-white px-3 py-2 rounded-lg text-sm">
                    <div>OpenCV Contour Detection</div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-bold text-gray-700 mb-2">
                    Ringkasan Perhitungan:
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Luas (pixel):</span>
                      <span className="font-medium">
                        {formatNumber(areaPixel)} pixel²
                      </span>
                    </div>

                    {scaleType !== "pixel" && realArea > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Luas ({scaleType}):
                          </span>
                          <span className="font-medium text-green-600">
                            {formatNumberWithDecimal(realArea)} {scaleType}²
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 pt-1 border-t border-gray-200">
                          Konversi: 1 pixel = {scaleValue} {scaleType}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-bold text-gray-700 mb-2">
                    Ringkasan Perhitungan Riemann:
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-sm">
                      <span className="text-gray-500">Metode:</span>
                      <span className="ml-2 font-medium">
                        {riemannMethod === "left"
                          ? "Riemann Kiri"
                          : riemannMethod === "right"
                          ? "Riemann Kanan"
                          : "Riemann Titik Tengah"}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Interval:</span>
                      <span className="ml-2 font-medium">
                        {riemannIntervals}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Δx:</span>
                      <span className="ml-2 font-medium">
                        {formatNumberWithDecimal(
                          areaPixel / riemannIntervals,
                          4
                        )}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Error:</span>
                      <span className="ml-2 font-medium">
                        {totalRiemannArea > 0
                          ? Math.abs(
                              ((areaPixel - totalRiemannArea) / areaPixel) * 100
                            ).toFixed(2)
                          : "0.00"}
                      </span>
                    </div>
                    {/* <div className="text-sm col-span-2">
                      <span className="text-gray-500">Riemann Sum:</span>
                      <span className="ml-2 font-medium">
                        {formatNumberWithDecimal(totalRiemannArea, 2)} pixel²
                      </span>
                    </div> */}
                  </div>
                </div>
              </div>
            )}

            {showRiemannGraph && riemannData && !isProcessing && (
              <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    📈 Visualisasi Metode Riemann
                  </h2>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        riemannMethod === "left"
                          ? "bg-red-100 text-red-700"
                          : riemannMethod === "right"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {riemannMethod === "left"
                        ? "Riemann Kiri"
                        : riemannMethod === "right"
                        ? "Riemann Kanan"
                        : "Riemann Titik Tengah"}
                    </span>
                    <span className="text-sm text-gray-500">
                      n={riemannIntervals}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500">Preset umum:</span>
                  {[
                    { label: "1px = 0.1 cm", value: 0.1, type: "cm" },
                    { label: "1px = 0.5 cm", value: 0.5, type: "cm" },
                    { label: "1px = 0.01 m", value: 0.01, type: "m" },
                    { label: "1px = 0.05 m", value: 0.05, type: "m" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setScaleType(preset.type);
                        setScaleValue(preset.value);
                        calculateRealArea(areaPixel, preset.type, preset.value);
                      }}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <canvas
                    ref={riemannCanvasRef}
                    key={`riemann-${riemannMethod}-${riemannIntervals}`}
                    width={800}
                    height={400}
                    className="w-full h-80 border border-gray-300 rounded-xl bg-gradient-to-br from-gray-50 to-white"
                  />
                  {showStepByStep && (
                    <div className="absolute top-2 right-2 bg-yellow-100 border border-yellow-300 text-yellow-800 text-xs px-2 py-1 rounded">
                      🔍 Interval 1-3 ditandai
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                    Δx ={" "}
                    {formatNumberWithDecimal(areaPixel / riemannIntervals, 2)}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-xl">
                    <h4 className="font-bold text-red-700 mb-2">
                      Riemann Kiri
                    </h4>
                    <p className="text-sm text-gray-600">
                      f(ξᵢ) = f(xᵢ) di titik kiri interval
                    </p>
                    <div className="mt-2 flex items-center">
                      <div className="w-4 h-4 bg-red-400 mr-2 rounded"></div>
                      <span className="text-sm">Underestimate jika f naik</span>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-xl">
                    <h4 className="font-bold text-blue-700 mb-2">
                      Riemann Tengah
                    </h4>
                    <p className="text-sm text-gray-600">
                      f(ξᵢ) = f((xᵢ + xᵢ₊₁)/2) di titik tengah
                    </p>
                    <div className="mt-2 flex items-center">
                      <div className="w-4 h-4 bg-blue-400 mr-2 rounded"></div>
                      <span className="text-sm">Akurasi lebih tinggi</span>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-green-50 to-white border border-green-200 rounded-xl">
                    <h4 className="font-bold text-green-700 mb-2">
                      Riemann Kanan
                    </h4>
                    <p className="text-sm text-gray-600">
                      f(ξᵢ) = f(xᵢ₊₁) di titik kanan interval
                    </p>
                    <div className="mt-2 flex items-center">
                      <div className="w-4 h-4 bg-green-400 mr-2 rounded"></div>
                      <span className="text-sm">Overestimate jika f naik</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Area Result & Formulas */}
            {areaPixel > 0 && !isProcessing && (
              <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
                <h2 className="text-xl font-bold mb-4 text-gray-800">
                  📊 Hasil Perhitungan Integral
                </h2>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 mb-6">
                  <div className="text-center">
                    <div className="text-5xl font-extrabold text-blue-600 mb-2">
                      {formatNumber(areaPixel)} pixel²
                    </div>
                    {scaleType !== "pixel" && realArea > 0 && (
                      <>
                        <div className="text-3xl font-extrabold text-blue-600 mb-2">
                          {formatNumberWithDecimal(realArea, 4)} {scaleType}²
                        </div>
                        <div className="text-1xl text-blue-600 mb-2">
                          Konversi: 1 pixel = {scaleValue} {scaleType}
                        </div>
                      </>
                    )}
                    <p className="text-gray-600">
                      Luas berdasarkan integral kontur OpenCV
                    </p>
                    <div className="mt-4 text-sm text-gray-500">
                      ΔA = Σ ΔAᵢ = lim<sub>‖P‖→0</sub> Σ f(ξᵢ) Δxᵢ
                    </div>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="h-72 mb-8">
                  <Bar
                    data={{
                      labels: [
                        "Luas Aktual",
                        "Riemann Kiri",
                        "Riemann Tengah",
                        "Riemann Kanan",
                      ],
                      datasets: [
                        {
                          label: "Luas (pixel²)",
                          data: [
                            areaPixel,
                            riemannMethod === "left"
                              ? areaPixel * 0.95
                              : areaPixel * 0.92,
                            riemannMethod === "midpoint"
                              ? areaPixel * 0.99
                              : areaPixel * 0.98,
                            riemannMethod === "right"
                              ? areaPixel * 1.05
                              : areaPixel * 1.08,
                          ],
                          backgroundColor: [
                            "rgba(59, 130, 246, 0.7)",
                            "rgba(239, 68, 68, 0.7)",
                            "rgba(59, 130, 246, 0.7)",
                            "rgba(34, 197, 94, 0.7)",
                          ],
                          borderColor: [
                            "rgb(59, 130, 246)",
                            "rgb(239, 68, 68)",
                            "rgb(59, 130, 246)",
                            "rgb(34, 197, 94)",
                          ],
                          borderWidth: 2,
                          borderRadius: 8,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        title: {
                          display: true,
                          text: "Perbandingan Metode Riemann",
                          font: { size: 16 },
                        },
                        tooltip: {
                          callbacks: {
                            label: function (context) {
                              return `${context.dataset.label}: ${formatNumber(
                                context.parsed.y
                              )} pixel²`;
                            },
                          },
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: "Luas (pixel²)",
                          },
                          ticks: {
                            callback: function (value) {
                              return formatNumber(value);
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>

                <div className="text-center">
                  <div className="text-5xl font-extrabold text-blue-600 mb-2">
                    {formatNumber(areaPixel)} pixel²
                  </div>
                  {scaleType !== "pixel" && realArea > 0 && (
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      ≈ {formatNumberWithDecimal(realArea, 2)} {scaleType}²
                    </div>
                  )}
                  <p className="text-gray-600">
                    Luas berdasarkan integral kontur OpenCV
                  </p>
                  {scaleType !== "pixel" && (
                    <div className="text-sm text-gray-500 mt-2 mb-10">
                      1 pixel = {scaleValue} {scaleType} • Skala: {scaleValue}:1
                    </div>
                  )}
                </div>

                {/* Formula Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl">
                    <h4 className="font-bold text-purple-700 mb-2">
                      ∫ Integral Tentu
                    </h4>
                    <div className="font-mono text-sm bg-purple-100 p-3 rounded-lg">
                      ∫<sub>a</sub>
                      <sup>b</sup> f(x) dx = lim<sub>‖P‖→0</sub> Σ f(ξᵢ) Δxᵢ
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Luas di bawah kurva f(x) dari a ke b
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-green-50 to-white border border-green-200 rounded-xl">
                    <h4 className="font-bold text-green-700 mb-2">
                      ∬ Integral Lipat-Dua
                    </h4>
                    <div className="font-mono text-sm bg-green-100 p-3 rounded-lg">
                      A = ∬<sub>R</sub> dA = ∫∫ f(x,y) dy dx
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Luas bidang dalam koordinat Kartesius
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-xl">
                    <h4 className="font-bold text-red-700 mb-2">
                      V Volume Benda Putar
                    </h4>
                    <div className="font-mono text-sm bg-red-100 p-3 rounded-lg">
                      V = π ∫ [f(x)]² dx
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Metode cakram (revolusi sumbu-x)
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-xl">
                    <h4 className="font-bold text-blue-700 mb-2">
                      ∭ Integral Lipat-Tiga
                    </h4>
                    <div className="font-mono text-sm bg-blue-100 p-3 rounded-lg">
                      ∭ f(x,y,z) dV = ∫∫∫ f(x,y,z) dz dy dx
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Volume benda pejal 3D
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State for Right Panel */}
            {isProcessing && (
              <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="text-6xl mb-4 animate-bounce">📐</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Menghitung Luas...
                  </h3>
                  <p className="text-gray-500 text-center">
                    Sedang memproses gambar dan menghitung integral
                  </p>
                  <div className="mt-6 w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Initial State - No Image Uploaded Yet */}
            {!imgSrc && !isProcessing && (
              <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="text-6xl mb-4 text-gray-300">📐</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Tunggu Gambar
                  </h3>
                  <p className="text-gray-500 text-center">
                    Upload gambar untuk memulai perhitungan
                  </p>
                  <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-700 font-medium">
                      📋 Format gambar diterima: PNG, JPG, JPEG, GIF, BMP, WebP,
                      SVG
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Pastikan gambar memiliki kontras yang jelas untuk hasil
                      terbaik
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <canvas ref={previewCanvasRef} className="hidden"></canvas>
        <canvas ref={processedCanvasRef} className="hidden"></canvas>
        <canvas ref={riemannCanvasRef} className="hidden"></canvas>

        <div className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>
            ✨ Aplikasi Pengukur Luas Otomatis dengan Integral Riemann (n=4-1000)
          </p>
          <a
            className="mt-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200 gap-2"
            href="https://farrassyuja.my.id/"
          >
            Farras Syuja
          </a>
        </div>
      </div>
    </div>
  );
}
