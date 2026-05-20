import asyncio
import os

from dotenv import load_dotenv

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
)

from sqlalchemy.orm import sessionmaker

from app.seeds.role import seed_roles

from app.seeds.superadmin import seed_super_admin

from app.seeds.superviser import seed_supervisor

from app.seeds.admin import seed_admin

from app.seeds.user import seed_user

load_dotenv()


DATABASE_URL = os.getenv("DATABASE_URL")


engine = create_async_engine(
    DATABASE_URL,
    connect_args={
        "ssl": "require"
    }
)


AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def run_seed():

    async with AsyncSessionLocal() as session:

        await seed_roles(session)

        await seed_supervisor(session)

        await seed_admin(session)

        await seed_user(session)

        await seed_super_admin(session)


if __name__ == "__main__":
    asyncio.run(run_seed())