from fastapi import APIRouter, HTTPException, status

from app.schemas.command import ParseCommandRequest, ParseCommandResponse
from app.services.command_parser import parse_command as parse_command_service

router = APIRouter(tags=["commands"])


@router.post("/parse", response_model=ParseCommandResponse)
def parse_command(request: ParseCommandRequest) -> ParseCommandResponse:
    # 路由层只处理 HTTP 入参和响应，解析逻辑放在 service 层。
    try:
        return parse_command_service(request.text, request.scene, request.threadId)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"画图模型解析失败：{exc}",
        ) from exc
