from fastapi import APIRouter

from app.schemas.command import ParseCommandRequest, ParseCommandResponse
from app.services.command_parser import parse_mock_command

router = APIRouter(tags=["commands"])


@router.post("/parse", response_model=ParseCommandResponse)
def parse_command(request: ParseCommandRequest) -> ParseCommandResponse:
    # 路由层只处理 HTTP 入参和响应，解析逻辑放在 service 层。
    return parse_mock_command(request.text, request.scene)
