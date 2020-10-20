<?php namespace Model\AdminFront\Migrations;

use Model\Db\Migration;

class Migration_20201020111900_UsersCustomizationsTable extends Migration
{
	public function exec()
	{
		$this->createTable('admin_user_customizations');
		$this->addColumn('admin_user_customizations', 'path', ['null' => false]);
		$this->addColumn('admin_user_customizations', 'user', ['type' => 'INT', 'null' => false]);
		$this->addColumn('admin_user_customizations', 'key', ['null' => false]);
		$this->addColumn('admin_user_customizations', 'value', ['type' => 'TEXT', 'null' => false]);
	}

	public function check(): bool
	{
		return $this->tableExists('admin_user_customizations');
	}
}
