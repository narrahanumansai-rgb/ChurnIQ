import os
import logging
import warnings
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from mangum import Mangum
warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_TASK_ROOT   = os.environ.get("LAMBDA_TASK_ROOT", os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH   = os.environ.get("MODEL_PATH",  os.path.join(_TASK_ROOT, "models", "churn_model.pkl"))
SCALER_PATH  = os.environ.get("SCALER_PATH", os.path.join(_TASK_ROOT, "models", "scaler.pkl"))
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")

app = FastAPI(
    title="Customer Churn Prediction API",
    description="Serverless ML API that predicts telecom customer churn.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

try:
    model  = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    logger.info("Model and scaler loaded from %s / %s", MODEL_PATH, SCALER_PATH)
except Exception as exc:
    logger.exception("Failed to load model artefacts")
    raise RuntimeError(f"Model loading failed: {exc}") from exc

FEATURE_COLUMNS = [
    "SeniorCitizen", "tenure", "MonthlyCharges", "TotalCharges",
    "gender_Male", "Partner_Yes", "Dependents_Yes", "PhoneService_Yes",
    "MultipleLines_No phone service", "MultipleLines_Yes",
    "InternetService_Fiber optic", "InternetService_No",
    "OnlineSecurity_No internet service", "OnlineSecurity_Yes",
    "OnlineBackup_No internet service", "OnlineBackup_Yes",
    "DeviceProtection_No internet service", "DeviceProtection_Yes",
    "TechSupport_No internet service", "TechSupport_Yes",
    "StreamingTV_No internet service", "StreamingTV_Yes",
    "StreamingMovies_No internet service", "StreamingMovies_Yes",
    "Contract_One year", "Contract_Two year",
    "PaperlessBilling_Yes",
    "PaymentMethod_Credit card (automatic)",
    "PaymentMethod_Electronic check",
    "PaymentMethod_Mailed check",
]

class CustomerData(BaseModel):
    gender: str             = Field(..., example="Male")
    SeniorCitizen: int      = Field(..., ge=0, le=1, example=0)
    Partner: str            = Field(..., example="Yes")
    Dependents: str         = Field(..., example="No")
    tenure: int             = Field(..., ge=0, example=24)
    PhoneService: str       = Field(..., example="Yes")
    MultipleLines: str      = Field(..., example="No")
    InternetService: str    = Field(..., example="Fiber optic")
    OnlineSecurity: str     = Field(..., example="No")
    OnlineBackup: str       = Field(..., example="Yes")
    DeviceProtection: str   = Field(..., example="No")
    TechSupport: str        = Field(..., example="No")
    StreamingTV: str        = Field(..., example="Yes")
    StreamingMovies: str    = Field(..., example="No")
    Contract: str           = Field(..., example="Month-to-month")
    PaperlessBilling: str   = Field(..., example="Yes")
    PaymentMethod: str      = Field(..., example="Electronic check")
    MonthlyCharges: float   = Field(..., gt=0, example=70.35)
    TotalCharges: float     = Field(..., ge=0, example=1687.58)

    model_config = {
        "json_schema_extra": {
            "example": {
                "gender": "Male", "SeniorCitizen": 0, "Partner": "Yes",
                "Dependents": "No", "tenure": 24, "PhoneService": "Yes",
                "MultipleLines": "No", "InternetService": "Fiber optic",
                "OnlineSecurity": "No", "OnlineBackup": "Yes",
                "DeviceProtection": "No", "TechSupport": "No",
                "StreamingTV": "Yes", "StreamingMovies": "No",
                "Contract": "Month-to-month", "PaperlessBilling": "Yes",
                "PaymentMethod": "Electronic check",
                "MonthlyCharges": 70.35, "TotalCharges": 1687.58,
            }
        }
    }

class PredictionResponse(BaseModel):
    churn_prediction: str
    churn_probability: float
    risk_label: str

def _eq(value: str, target: str) -> int:
    return 1 if value == target else 0

def build_feature_vector(data: CustomerData) -> pd.DataFrame:
    features = {
        "SeniorCitizen":                            data.SeniorCitizen,
        "tenure":                                   data.tenure,
        "MonthlyCharges":                           data.MonthlyCharges,
        "TotalCharges":                             data.TotalCharges,
        "gender_Male":                              _eq(data.gender, "Male"),
        "Partner_Yes":                              _eq(data.Partner, "Yes"),
        "Dependents_Yes":                           _eq(data.Dependents, "Yes"),
        "PhoneService_Yes":                         _eq(data.PhoneService, "Yes"),
        "MultipleLines_No phone service":           _eq(data.MultipleLines, "No phone service"),
        "MultipleLines_Yes":                        _eq(data.MultipleLines, "Yes"),
        "InternetService_Fiber optic":              _eq(data.InternetService, "Fiber optic"),
        "InternetService_No":                       _eq(data.InternetService, "No"),
        "OnlineSecurity_No internet service":       _eq(data.OnlineSecurity, "No internet service"),
        "OnlineSecurity_Yes":                       _eq(data.OnlineSecurity, "Yes"),
        "OnlineBackup_No internet service":         _eq(data.OnlineBackup, "No internet service"),
        "OnlineBackup_Yes":                         _eq(data.OnlineBackup, "Yes"),
        "DeviceProtection_No internet service":     _eq(data.DeviceProtection, "No internet service"),
        "DeviceProtection_Yes":                     _eq(data.DeviceProtection, "Yes"),
        "TechSupport_No internet service":          _eq(data.TechSupport, "No internet service"),
        "TechSupport_Yes":                          _eq(data.TechSupport, "Yes"),
        "StreamingTV_No internet service":          _eq(data.StreamingTV, "No internet service"),
        "StreamingTV_Yes":                          _eq(data.StreamingTV, "Yes"),
        "StreamingMovies_No internet service":      _eq(data.StreamingMovies, "No internet service"),
        "StreamingMovies_Yes":                      _eq(data.StreamingMovies, "Yes"),
        "Contract_One year":                        _eq(data.Contract, "One year"),
        "Contract_Two year":                        _eq(data.Contract, "Two year"),
        "PaperlessBilling_Yes":                     _eq(data.PaperlessBilling, "Yes"),
        "PaymentMethod_Credit card (automatic)":    _eq(data.PaymentMethod, "Credit card (automatic)"),
        "PaymentMethod_Electronic check":           _eq(data.PaymentMethod, "Electronic check"),
        "PaymentMethod_Mailed check":               _eq(data.PaymentMethod, "Mailed check"),
    }
    return pd.DataFrame([features], columns=FEATURE_COLUMNS)

def _risk_label(prob_pct: float) -> str:
    if prob_pct >= 70:
        return "High Risk"
    if prob_pct >= 40:
        return "Medium Risk"
    return "Low Risk"

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "Churn Prediction API is running."}

@app.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
def predict_churn(data: CustomerData):
    try:
        df      = build_feature_vector(data)
        scaled  = scaler.transform(df)
        pred    = int(model.predict(scaled)[0])
        prob    = float(model.predict_proba(scaled)[0][1])
        prob_pct = round(prob * 100, 2)
        label   = _risk_label(prob_pct)

        logger.info("prediction=%s probability=%.2f risk=%s", pred, prob_pct, label)

        return PredictionResponse(
            churn_prediction="Yes" if pred == 1 else "No",
            churn_probability=prob_pct,
            risk_label=label,
        )
    except Exception as exc:
        logger.exception("Prediction failed")
        raise HTTPException(status_code=500, detail=str(exc))

_static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")

handler = Mangum(app, lifespan="off")