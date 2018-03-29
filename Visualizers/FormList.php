<?php namespace Model\AdminFront\Visualizers;

use Model\AdminFront\DataVisualizer;
use Model\Core\Autoloader;
use Model\Core\Core;
use Model\Core\Exception;
use Model\Form\Form;
use Model\ORM\Element;

class FormList extends DataVisualizer
{
	/** @var array */
	protected $defaultOptions = [
		'fields' => [],
	];

	function __construct(Core $core, array $options = [])
	{
		parent::__construct($core, $options);
		if (!isset($this->options['print']))
			$this->options['print'] = false;
	}

	/**
	 * @param array $options
	 */
	public function render(array $options = [])
	{
		$options = array_merge([
			'type' => 'row',
			'class' => 'rob-field-cont sublist-row',
			'template' => null,
			'add-button' => true,
			'list' => [],
		], $options);

		echo '<div id="cont-ch-' . entities($this->options['name']) . '" data-rows-class="' . $options['class'] . '">';

		$dummyForm = $this->getRowForm($this->options['dummy'], $options);

		if ($options['type'] === 'row') {
			echo '<div class="rob-field-cont">';
			if (!$this->options['print'])
				echo '<div class="rob-field" style="width: 5%"></div>';
			echo '<div class="rob-field" style="width: 95%">';
			echo '<div class="rob-field-cont sublist-row">';
			$template = $dummyForm->getTemplate(['one-row' => true]);
			foreach ($template as $f) {
				echo '<div class="rob-field" style="width: ' . $f['w'] . '%'.($this->options['print'] ? ';font-weight: bold' : '').'">' . entities($dummyForm[$f['field']]->getLabel()) . '</div>';
			}
			echo '</div>';
			echo '</div>';
			echo '</div>';
		}

		foreach ($options['list'] as $el) {
			?>
            <div class="rob-field-cont sublist-row" id="cont-ch-<?= entities($this->options['name']) ?>-<?= entities($el[$el->settings['primary']]) ?>">
				<?php
				$form = $this->getRowForm($el, $options);
				$this->renderRow($el, $form, $options);
				?>
            </div>
			<?php
		}

		echo '</div>';

		if ($options['add-button'] and !$this->options['print']) {
			if ($options['add-button'] === true) {
				?>
                <div class="rob-field-cont sublist-row" style="cursor: pointer" onclick="sublistAddRow('<?= entities($this->options['name']) ?>')">
                    <div class="rob-field" style="width: 5%"></div>
                    <div class="rob-field" style="width: 95%">
                        <i class="fas fa-plus" aria-hidden="true"></i> Aggiungi
                    </div>
                </div>
				<?php
			} else {
				echo $options['add-button'];
			}
		}

		?>
        <div id="sublist-template-<?= entities($this->options['name']) ?>" class="sublist-template" style="display: none">
			<?php
			$this->renderRow($this->options['dummy'], $dummyForm, $options);
			?>
        </div>
		<?php
	}

	function print(array $options = [])
	{
		$this->options['print'] = true;
		$this->render($options);
	}

	protected function renderRow(Element $el, Form $form, array $options)
	{
		if (($options['type'] === 'inner-template' or $options['type'] === 'outer-template') and $options['template'] === null)
			$options['template'] = $this->options['name'];

		if ($options['template']) {
			$dir = $this->model->_AdminFront->url ? $this->model->_AdminFront->url . DIRECTORY_SEPARATOR : '';
			$template_path = Autoloader::searchFile('template', $dir . $this->model->_AdminFront->request[0] . DIRECTORY_SEPARATOR . $options['template']);
			if (!$template_path)
				$options['template'] = null;
		}

		if ($options['template'] and $options['type'] === 'outer-template') {
			include($template_path);
		} else {
			if (!$this->options['print']) {
				?>
                <div class="rob-field" style="width: 5%; text-align: center">
                    <a href="#" onclick="if(confirm('Sicuro di voler eliminare questa riga?')) sublistDeleteRow('<?= entities($this->options['name']) ?>', '<?= entities($el[$el->settings['primary']]) ?>'); return false"><i class="fas fa-trash" aria-label="Delete" style="color: #000"></i></a>
                    <input type="hidden" name="ch-<?= entities($this->options['name']) ?>-<?= entities($el[$el->settings['primary']]) ?>" value="1"/>
                </div><div class="rob-field" style="width: 95%">
				<?php
			} else {
				?>
                <div class="rob-field" style="width: 100%">
				<?php
			}
			if ($options['template'] and $options['type'] === 'inner-template') {
				include($template_path);
			} else {
				$form->render([
					'one-row' => $options['type'] === 'row',
					'show-labels' => $options['type'] === 'form',
				]);
			}
			?>
            </div>
			<?php
		}
	}

	public function getRowForm(Element $el, array $options): Form
	{
		$form = $this->model->_Admin->getSublistRowForm($el, $options);
		$form->options['wrap-names'] = 'ch-[name]-' . $this->options['name'] . '-' . $el[$el->settings['primary']];
		$form->options['print'] = $this->options['print'];
		$strip = $this->options['strip'] ?? [];
		foreach ($strip as $k)
			$form->remove($k);
		return $form;
	}

	public function parseActions(array $actions): array
	{
		foreach ($actions as $idx => &$act) {
			switch ($act['id']) {
				case 'delete':
					unset($actions[$idx]);
					break;
				case 'new':
					$act['action'] = 'sublistAddRow(\'list\', null, false); return false';
					break;
			}
		}
		$actions[] = [
			'id' => 'save',
			'text' => 'Salva',
			'icon' => null,
			'fa-icon' => 'far fa-save',
			'url' => '#',
			'action' => 'saveFormList(); return false',
		];
		return $actions;
	}

	public function saveFormList()
	{
		if ($this->model->_CSRF->checkCsrf() and isset($_POST['data'], $_POST['deleted'])) {
			$elements = json_decode($_POST['data'], true);
			if ($elements === null)
				die('Wrong data #2');
			$deleted = json_decode($_POST['deleted'], true);
			if ($deleted === null)
				die('Wrong data #3');

			try {
				$this->model->_Db->beginTransaction();

				foreach ($elements as $id => $data) {
					if (in_array($id, $deleted))
						continue;

					if (!is_numeric($id) and substr($id, 0, 3) === 'new') {
						$el = $this->model->_ORM->create($this->options['element'] ?: 'Element', ['table' => $this->options['table']]);
						$data = array_merge($this->model->_Admin->options['where'], $data);
						$el->save($data);
					} else {
						$el = $this->model->_ORM->one($this->options['element'] ?: 'Element', $id, ['table' => $this->options['table']]);
						$el->save($data);
					}
				}

				foreach ($deleted as $id) {
					if (!is_numeric($id))
						continue;

					$el = $this->model->_ORM->one($this->options['element'] ?: 'Element', $id, ['table' => $this->options['table']]);
					$el->delete();
				}

				$this->model->_Db->commit();

				echo json_encode(['status' => 'ok']);
			} catch (Exception $e) {
				$this->model->_Db->rollBack();
				echo getErr($e);
			}
		} else {
			echo 'Wrong data #1';
		}
		die();
	}
}
