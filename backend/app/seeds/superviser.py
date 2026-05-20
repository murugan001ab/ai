from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.role import Role
from app.core.security import get_password_hash


async def seed_supervisor(session: AsyncSession):

    result = await session.execute(
        select(User).where(
            User.email == "supervisor@zeekers.com"
        )
    )

    existing_user = result.scalar_one_or_none()

    if existing_user:
        print("✅ Supervisor Already Exists")
        return

    role_result = await session.execute(
        select(Role).where(
            Role.name == "SUPERVISOR"
        )
    )

    supervisor_role = role_result.scalar_one()

    super_admin = User(
        employee_id="EMP0003",
        name="Supervisor",
        email="supervisor@zeekers.com",
        password=get_password_hash("supervisor@123"),
        role_id=supervisor_role.id,
        is_active=True,
    )

    session.add(super_admin)

    await session.commit()

    print("✅ supervisor Created")